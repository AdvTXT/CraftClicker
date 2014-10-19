function Game()
{
  this.crafting = false;
  this.craftingNode = null;
  this.craftingQueue = [];
  this.player = new Player();
  
  //                        Grey    Green      Yellow     Orange
  this.difficultyColors = ['#555', '#00DD00', '#E6DE00', '#FF8E46'];
  //setInterval(this.updateUI, 500);
}

Game.prototype.updateUI = function() {
  var g = window.game;

  g.drawLevel();
  g.drawMoney();
  g.drawInventory();
  g.drawRecipes();
}

Game.prototype.step = function() {
  var drops = this.gather();
  this.player.collect(drops);
  this.updateUI();
}

Game.prototype.gather = function() {
  var drops = [];
  var pick = this.player.inventory.pick;
  for (var prop in Resources) {
    if(Resources.hasOwnProperty(prop)) {
      var item = Resources[prop];
      var lootModifier = (item == Resources.Wood ? 1 : 0);
      if (pick) {
        lootModifier = (typeof pick.LootModifiers[item.name] == "undefined" ? lootModifier : pick.LootModifiers[item.name]);
      }

      if (lootModifier == 0) {
        continue;
      }

      // Stop processing items if the player's level is too low
      if (item.minLevel > this.player.level) {
        break;
      }

      if (item.dropChance > this.r()) {
        drops.push({ item: item, amount: Math.ceil(this.r() * item.maxDropAmount * lootModifier)})
      }
    }
  }

  if (pick) {
    pick.durability -= 1;
    if (pick.durability == 0) {
      // The pick just broke.
      // Replace it with the highest level pick in the the player's inventory.
      var newPick = this.player.inventory.getHighestLevelPick();

      if (newPick) {
        this.player.inventory.items[newPick.name].amount -= 1;
        this.player.inventory.pick = {};
        $.extend(true, this.player.inventory.pick, newPick); // Deep copy new pick item (as to not modify original item)
        this.player.inventory.pick.maxDurability = newPick.durability;
        $('#gather').prop('src', newPick.image);
        $('#currentPick').text(newPick.name);
      }
      else {
        delete this.player.inventory.pick;
        $('#currentPick').text('Bare Hands');
        $('#gather').prop('src', 'images/pick-disabled.png');
      }

      $('#durability').hide();
    }
    else {
      // The pick is not broken.
      var maxWidth = 40;
      var width = maxWidth * pick.durability / pick.maxDurability;
      var red = Math.floor(255 * (1 - width / maxWidth));
      var green = Math.floor(192 * (width / maxWidth));
      var rgb = 'rgb(' + red + ', ' + green + ', 0)';
      $('#durability').show().width(width).css('background-color', rgb);
    }
  }

  return drops;
}

Game.prototype.craft = function(amount, itemLevel) {
  var $current = $('#recipeList li.selectedRecipe');
  if ($current.length > 0) {
    var item = $current.data();
    amount = parseInt(amount) || 1;
    $('#craftAmount').val(1); // Reset craft amount to 1
    this.craftRecipe(item, amount);
  }
}

Game.prototype.craftAll = function() {
  var $current = $('#recipeList li.selectedRecipe');
  if ($current.length > 0) {
    var item = $current.data();
    var amount = this.player.getCraftableAmount(item.Recipe);
    $('#craftAmount').val(1); // Reset craft amount to 1
    this.craftRecipe(item, amount);
  }
}

Game.prototype.craftRecipe = function(item, amount) {
  var g = window.game;
  var p = g.player;
  
  if (g.craftingNode) {
    var id = item.name.replace(/ /g, '');
    var $el = $('#r_' + id);
    var craftStatus = $('#rcs_' + id).text();

    if (craftStatus == '') {
      // Queue up the recipe
      g.craftingQueue.push({ item: item, amount: amount, el: $el });
      $('#rcs_' + id).show().text('Queued');
      $el.addClass('queued');
      setButtonState($el);
      return;
    }
    else if (craftStatus == 'Queued') {
      // The recipe is already queued. Remove it from the queue.
      $('#rcs_' + id).text('').hide();
      $el.removeClass('queued');
      for (var i = 0; i < g.craftingQueue.length; i++) {
        var x = g.craftingQueue[i];
        if (item.name == x.item.name) {
          g.craftingQueue.splice(i, 1);
          setButtonState(x.el);
          return;
        }
      }
    }
    else {
      // A recipe is already crafting.
      // Traverse up to the top-most recipe node.
      var node = g.craftingNode;
      while (node.parent) {
        node = node.parent;
      }
      
      // Cancel the crafting of this recipe node.
      g.cancelNodeFromRecipeTree(node);
      g.updateUI();
      
      if (g.craftingQueue.length > 0) {
        var x = g.craftingQueue.shift();
        x.el.removeClass('queued');
        setButtonState(x.el);
        g.craftRecipe(x.item, x.amount);
      }
      return;
    }
  }
  
  if (p.getCraftableAmount(item.Recipe) < amount) {
    return;
  }
  
  p.requestCrafting(item, amount);
  g.updateUI();
  g.craftRecipeTree();
}

Game.prototype.craftRecipeTree = function(complexity) {
  var g = window.game;
  var p = g.player;
  
  $('#craftAll').prop('disabled', 'disabled');
  $('#craft').val('Cancel');

  while(p.requiredRecipes.length > 0) {
    // Get and remove the first recipe in the queue.
    var node = p.requiredRecipes.shift();
    
    // Craft it.
    g.craftNodeFromRecipeTree(node);
  }
}

Game.prototype.cancelNodeFromRecipeTree = function(node) {
  var g = window.game;
  var p = g.player;
  
  var item = node.item;
  
  // Cancel the crafting
  item.Recipe.crafting = false;
  
  // Release the reserved resources back into the inventory
  for (var prop in node.reserved) {
    var amount = node.reserved[prop];
    var name = prop.replace(/ /g, '');
    var releasedItem = Items[name]; // Will be undefined if raw resource.
    
    var isForge = releasedItem && releasedItem.type && releasedItem.type == ItemType.Forge;
    if (isForge && p.inventory.forges.length < p.inventory.maxNumForges) {
      // Release the forges from the forge array first.
      var numForgesReleased = 0;
      for (var i = 0; i < p.inventory.forges.length; i++) {
        var forge = p.inventory.forges[i];
        if (forge.level == releasedItem.level && forge.reserved) {
          forge.reserved = false;
          numForgesReleased++;
        }
      }
      
      // Release the remaining forges into the inventory.
      if (numForgesReleased < amount) {
        p.inventory.mergeItemByName(prop, amount - numForgesReleased);
      }
    }
    else {
      p.inventory.mergeItemByName(prop, amount);
      g.drawInventory();
    }
  }
  
  var id = item.name.replace(/ /g, '');
  var $el = $('#r_' + id);
  
  if ($el.hasClass('animating')) {
    // Remove the background animation bar (unless recipe is selected)
    if (!$el.hasClass('selectedRecipe')) {
      unselectRecipe($el);
    }
    
    // Stop the animation
    $el.stop();
    $el.removeClass('animating');
  }

  // Return the width of the recipe to full-width
  $el.width(g.recipeWidth);
  
  // Remove the crafting status.
  $('#rcs_' + id).text('').hide();

  // Note that cancel is not occuring any longer.
  g.craftingNode = null;
  
  // Enable the Craft All button.
  $('#craftAll').removeAttr('disabled');

  // Switch the Cancel button to say Craft.
  $('#craft').val('Craft');
  
  while (node.children.length > 0) {
    var child = node.children.shift();
    g.cancelNodeFromRecipeTree(child);
  }
}

Game.prototype.craftNodeFromRecipeTree = function(node) {
  var g = window.game;
  var p = g.player;
  
  var req = node.item;
  var id = req.name.replace(/ /g, '');
  var $reqEl = $('#r_' + id);
  if (!$reqEl.hasClass('selectedRecipe')) {
    highlightRecipe($reqEl);
  }
  
  g.craftingNode = node;
  
  // Kick off the crafting animation.
  g.showCraftingAnimation(node, $reqEl,
    function()
    {
      node.crafted = true;
      req.Recipe.crafting = false;
      
      if (node.parent) {
        if (node.parent.children.every(function(c) { return c.crafted })) {
          // All children have been crafted. Move up to the parent.
          g.craftNodeFromRecipeTree(node.parent);
        }
      }
      else {
        // Nothing left to craft.
        g.craftingNode = null;
        
        if (g.craftingQueue.length > 0) {
          var x = g.craftingQueue.shift();
          x.el.removeClass('queued');
          g.craftRecipe(x.item, x.amount);
        }
        else {
          // Enable the Craft All button.
          $('#craftAll').removeAttr('disabled');

          // Switch the Cancel button to say Craft.
          $('#craft').val('Craft');
          
          g.updateUI();
        }
      }
    });
}

Game.prototype.showCraftingAnimation = function(requiredRecipe, el, doneCallback) {
  var g = window.game;
  var p = g.player;

  var item = requiredRecipe.item;
  var amount = requiredRecipe.amount;
  console.log("Crafting " + amount + " of " + item.name);

  var recipe = item.Recipe;
  var multiplier = 0;
  if (recipe.forge) {
    var smeltModifier = 1;
    for (var i = 0; i < p.inventory.forges.length; i++) {
      var forge = p.inventory.forges[i];
      if (forge.level >= recipe.forge.level) {
        smeltModifier = (forge.SmeltModifiers && typeof forge.SmeltModifiers[item.name] != "undefined" ? forge.SmeltModifiers[item.name] : smeltModifier);
        multiplier += smeltModifier;
      }
    }
  }

  multiplier = multiplier || 1;
  var craftTime = Math.round(recipe.craftTime * 1000 / multiplier);
  craftTime = this.cheat ? 0 : craftTime;
  craftTime = (this.slow ? craftTime * 10 : craftTime);
  
  // Disable the Craft All button
  $('#craftAll').prop('disabled', 'disabled');

  // Switch the Craft button to say Cancel
  $('#craft').val('Cancel');

  var id = item.name.replace(/ /g, '');
  $('#rcs_' + id).show().text('Crafting ' + amount);
  
  recipe.crafting = true;
  var parent = requiredRecipe.parent;
  while(parent) {
    parent.item.Recipe.crafting = true;
    var parentId = parent.item.name.replace(/ /g, '');
    $('#rcs_' + parentId).show().text('Waiting');
    $('#r_' + parentId).addClass('animating');
    parent = parent.parent;
  }

  // Begin the crafting animation.
  el.addClass('animating').width(0).animate(
    { width: g.recipeWidth },
    craftTime,
    "linear",
    function() {    
      // Recipes that take longer to craft result in more XP.
      var xpModifier = Math.min(1, recipe.craftTime / 5.0);
      p.craft(requiredRecipe, xpModifier);
      g.updateUI();
      drawCurrentRecipeRequirements();
      if (requiredRecipe.amount > 0) {
        g.showCraftingAnimation(requiredRecipe, el, doneCallback);
      }
      else if (doneCallback) {
        doneCallback();
      }

      if (requiredRecipe.amount == 0) {
        $('#rcs_' + id).text('').hide();
        $(this).removeClass('animating');

        // During the crafting, the selected recipe could have changed.
        // If so, remove the background bar at the end of the animation.
        if (!el.hasClass('selectedRecipe')) {
          unselectRecipe(el);
        }
      }
    });
}

Game.prototype.getPlayerLevelText = function() {
  return 'Level ' + this.player.level;
}

Game.prototype.getPlayerExperienceText = function() {
  return Math.round(this.player.xp) + ' / ' + this.player.xpMax;
}

Game.prototype.drawLevel = function() {
  var g = window.game;
  var p = g.player;

  var maxWidth = $('#experienceBarText').width();
  $('#experienceBar').width(Math.round(maxWidth * p.xp / p.xpMax));

  if (g.experienceShown) {
    $('#experienceBarText').text(g.getPlayerExperienceText());
  }
  else {
    $('#experienceBarText').text(g.getPlayerLevelText());
  }
}

Game.prototype.drawMoney = function() {
  var g = window.game;
  var p = g.player;
  $('#money').text(Inventory.getMoneyString(p.money));
}

Game.prototype.drawRecipes = function() {
  var g = window.game;
  var p = g.player;

  for (var prop in Items) {
    if (Items.hasOwnProperty(prop)) {
      var item = Items[prop];
      var recipe = item.Recipe;
      if (recipe.available) {
        var amount = p.getCraftableAmount(recipe);
        var id = prop.replace(/ /g, '');
        var $row = $('#r_' + id);
        if ($row.length) {
          // Row for recipe already exists.
          var color = g.determineRecipeColor(recipe);
          $('#ra_' + id).text(amount > 0 ? '[' + amount + ']' : '');

          // Add a tooltip that says how many of the item exists in the inventory
          if (p.inventory.items[item.name]) {
            var currentAmount = p.inventory.items[item.name].amount;
            $('#r_' + id).prop('title', item.name + ' inventory: ' + currentAmount);
          }
          
          var isAnimating = $row.hasClass('animating');
          if ($row.hasClass('selectedRecipe') || isAnimating) {
            $row.css('background-color', color);
            $row.css('color', 'white');

            var cantCraft = (!g.craftingNode && amount == 0);
            if (cantCraft) {
              $('#craftAll').prop('disabled', 'disabled');
              $('#craft').prop('disabled', 'disabled');
            }
            else if (!g.craftingNode) {
              $('#craftAll').removeAttr('disabled');
              $('#craft').removeAttr('disabled');
            }
          }
          else
          {
            $row.css('color', color);
          }
        }
        else {
          // Recipe was just unlocked.
          // Add a new row for it.
          $('#recipeList').prepend(
            $('<li/>',
            {
              id: 'r_' + id,
              data: item,
            })
            .append(
              $('<div/>',
              {
                id: 'rn_' + id,
                text: item.name,
                class: 'recipeName',
              })
              .append(
                $('<span/>',
                {
                  id: 'ra_' + id,
                  text: amount > 0 ? '[' + amount + ']' : ''
                }))
              .append(
                $('<span/>',
                {
                  id: 'rcs_' + id,
                  class: 'floatRight scrollbarPadding'
                })
              )
            )
            .css('color', g.determineRecipeColor(recipe))
            .click(function() { selectRecipe($(this)) })
            .dblclick(function() { g.craft($('#craftAmount').val()) })
          );
          $('#rn_' + id).width(g.recipeWidth).hide().fadeIn();
        }
      }
    }
  }

  var $current = $('#recipeList li.selectedRecipe');
  if ($current.length) {
    if (!$current.hasClass('animating')) {
      drawRecipeRequirements($current);
    }
  }
}

Game.prototype.drawInventory = function() {
  var g = window.game;
  var p = g.player;
  var inv = p.inventory;
  
  for (var prop in inv.items) {
    if(inv.items.hasOwnProperty(prop)) {
      var amount = inv.getNumberOfItemFromInventory(prop);
      var id = prop.replace(/ /g, '')
      var value = $('#iv_' + id);
      if (value.length) {
        $('#inventory').show();
        value.text(amount);
      }
      else {
        if (amount > 0) {
          var $newRow = $('<tr/>', 
          {
            id: 'ir_' + id
          }).append(
              $('<td/>',
              {
                id: 'in_' + id,
                text: prop,
                class: 'alignRight'
              })
            )
            .append(
              $('<td/>',
              {
                id: 'iv_' + id,
                text: amount
              })
            )
            .append(
              $('<td/>').append(
                $('<span/>',
                {
                  id: 'ik_' + id,
                  text: '\u221E'
                }).on('click',
                function() {
                  $('#ik_' + id).hide();
                  $('#iktb_' + id).show().focus();
                }
              )
              ).append(
               $('<input/>',
                {
                  id: 'iktb_' + id,
                  class: 'keep',
                })
                .on('keypress', function() {
                  return event.charCode >= 48 && event.charCode <= 57;
                })
                .blur(
                  function() {
                    var val = $(this).val();
                    var val = (val == '' ? -1 : val);
                    $('#ik_' + id).text(val >= 0 ? val : '\u221E').show();
                    $(this).hide();
                    
                    var invItem = inv.items[prop];
                    invItem.keep = parseInt(val);
                    
                    if (invItem.keep >= 0 && invItem.keep < invItem.amount) {
                      p.sellItem(invItem.Item, invItem.amount - invItem.keep);
                      invItem.amount = invItem.keep;
                      g.updateUI();
                    }
                  }
                )
                .hide()
              )
            );

          // If no invetory rows exist, add it to the <tbody>
          var $tbody = $('#inventoryTable tbody');
          var $rows = $('#inventoryTable td[id*=in]');
          if (!$rows.length) {
            $tbody.append($newRow);
            return;
          }

          // Keep the table sorted.
          // Find the first row whose name is alphatetically greater than the new name
          var $row = null;
          $('#inventoryTable td[id*=in]').each(function() {
            if ($(this).text().localeCompare(prop) == 1) {
              $row = $(this).parent();
              return false;
            }
          });

          if ($row) {
            $row.before($newRow);
          }
          else {
            // No row found, put it at the end
            $('#inventoryTable tbody tr:last').after($newRow);
          }
        }
      }
    }
  }
}

Game.prototype.determineRecipeColor = function(recipe) {
  var g = window.game;
  var p  = g.player;

  var diff = p.determineRecipeDifficulty(recipe);
  return g.difficultyColors[diff];
}

Game.prototype.r = function() {
  return Math.random();
}

var game = new Game();

highlightRecipe = function(el) {
  if (!el.hasClass('animating')) {
    el.css('background-color', el.css('color'))
    el.css('color', '')
    el.addClass('background');
  }
  
  setButtonState(el);
}

setButtonState = function(el) {
  var amount = el.find('span').text();
  if (el.hasClass('animating') || el.hasClass('queued')) {
    $('#craft').val('Cancel');
    $('#craft').removeAttr('disabled');
    $('#craftAll').prop('disabled', 'disabled');
  }
  
  if (!el.hasClass('animating')) {  
    if (!el.hasClass('queued')) {
      if (amount != '') {
        $('#craft').val('Craft');
        $('#craft').removeAttr('disabled');
        $('#craftAll').removeAttr('disabled');
      }
      else {
        $('#craft').prop('disabled', 'disabled');
        $('#craftAll').prop('disabled', 'disabled');
      }
    }
  }
}

selectRecipe = function(el) {
  var $current = $('#recipeList li.selectedRecipe');
  if ($current.length) {
    if (!$current.hasClass('animating')) {
      unselectRecipe($current);
    }

    $current.removeClass('selectedRecipe');
  }

  highlightRecipe(el);
  el.addClass('selectedRecipe');
  drawRecipeRequirements(el);
}

unselectRecipe = function(el) {
  el.removeClass('background');
  el.css('color', el.css('background-color'))
  el.css('background-color', '')
}

drawCurrentRecipeRequirements = function() {
  var $current = $('#recipeList li.selectedRecipe');
  if ($current.length) {
    drawRecipeRequirements($current);
  }
}

drawRecipeRequirements = function(el) {
  var g = window.game;
  var p = g.player;

  var $div = $('#recipeRequirements');
  var item = el.data();
  var recipe = item.Recipe;
  var id = item.name.replace(/ /g, '')

  $div.empty();

  $('<h2/>', {
    id: 'recipeName',
    text: item.name,
  }).appendTo($div);

  $('<h4/>', {
    id: 'craftTime',
    text: 'Craft time: ' + createTimeString(recipe.craftTime),
  }).appendTo($div);

  if (item.unlocks) {
    var unlockStr = '';
    for (var i = 0; i < item.unlocks.length; i++) {
      var itemName = Items[item.unlocks[i]].name;
      unlockStr += itemName;
      if (i < item.unlocks.length - 1) {
        if (item.unlocks.length > 2) {
          unlockStr += ', '
        }
        
        if (i == item.unlocks.length - 2) {
          unlockStr += ' and ';
        }
      }
    }
    
    var $unlocks = $('<p/>', {
      class: 'recipeUnlocks',
      text: 'Unlocks: ' + unlockStr
    }).appendTo($div);
  }
  
  if (recipe.text) {
    $('<p/>', {
      text: recipe.text,
      class: 'recipeDesc'
    }).appendTo($div);
  }
  
  $('<p/>', {
    text: 'Sells for ' + Inventory.getMoneyString(item.sellValue),
    class: 'recipeSellsFor'
  }).appendTo($div);


  if (recipe.forge) {
    var $reqForge = $('<p/>', {
      id: 'requiresForge',
      text: 'Requires '
    });

    var forgeId = recipe.forge.name.replace(/ /g, '');    
    $('<a/>',
    {
      text: recipe.forge.name,
      href: '#'

    }).click(function()
    {
      selectRecipe($('#r_' + forgeId));
    }).appendTo($reqForge);

    $reqForge.appendTo($div);

    if (!p.inventory.forges.some(function(f) { return f.level >= recipe.forge.level })) {
      $reqForge.addClass('missing');
    }
  }

  var $table = drawRecipeRequirementsTable(recipe, p, id);
  $div.append($table);
}

drawRecipeRequirementsTable = function(recipe, p, id) {
  var $table = $('<table/>', {
    id: 'recipeRequirementList'
  });

  var $tbody = $('<tbody/>');
  for (var i = 0; i < recipe.Requirements.length; i++) {
    var req = recipe.Requirements[i];
    var isForge = req.resource.type && req.resource.type == ItemType.Forge;

    var missingAmount = 0;
    var currentAmount = (p.inventory.items[req.resource.name] ? p.inventory.items[req.resource.name].amount : 0);
    if (isForge) {
      var forgeLevel = req.resource.level;
      for (var j = 0; j < p.inventory.forges.length; j++) {
        var forge = p.inventory.forges[j];
        if (forge.level == forgeLevel) {
          currentAmount++;
        }
      }
    }

    if (currentAmount < req.amount) {
      missingAmount = req.amount - currentAmount;
    }

    var $row = $('<tr/>');
    $('<td/>', {
      id: 'rrv_' + id,
      class: 'alignRight',
      text: (missingAmount > 0 ? currentAmount + '/' : '') + req.amount
    }).appendTo($row);

    var $name = $('<td/>');

    if (req.resource.Recipe) {
      var reqId = req.resource.name.replace(/ /g, '')
      $('<a/>',
      {
        id: 'rrn_' + reqId,
        text: req.resource.name,
        href: "#",
      }).click(function()
      {
        selectRecipe($('#r_' + $(this).prop('id').replace('rrn_', '')));
      }).appendTo($name);
    }
    else {
      $('<span/>',
      {
        text: req.resource.name,
      }).appendTo($name);
    }

    $('<span/>', 
    {
      id: 'rra_' + reqId,
      text: '(' + currentAmount + ')',
      class: 'amount'
    }).appendTo($name);

    $name.appendTo($row);

    if (missingAmount > 0) {
      $row.addClass('missing');
    }

    $tbody.append($row);
  }

  $table.append($tbody);
  return $table;
}

createTimeString = function(time) {
  // http://stackoverflow.com/a/11486026
  var mins = ~~(time / 60);
  var secs = time % 60;

  // Hours, minutes and seconds
  var hrs = ~~(time / 3600);
  var mins = ~~((time % 3600) / 60);
  var secs = time % 60;

  // Output like "1:01" or "4:03:59" or "123:03:59"
  ret = "";

  if (hrs > 0) {
      ret += "" + hrs + " hour" + (hrs != 1 ? "s" : "") + (mins > 0 || secs > 0 ? ", " : "");
  }

  if (mins > 0) {
    ret += "" + mins + " minute" + (mins != 1 ? "s" : "") + (secs > 0 ? ", " : "");
  }
  
  if (secs > 0) {
    ret += "" + secs + " second" + (secs != 1 ? "s" : "");
  }

  return ret;
}

$(document).ready(function() {
  $('body')
    .bind("contextmenu", function(e) { return false; })
    .attr('unselectable', 'on')
    .css({
      MozUserSelect: 'none',
      KhtmlUserSelect: 'none',
      WebkitUserSelect: 'none',
      userSelect: 'none'
    })
    .each(function() { 
      this.onselectstart = function() { return false; };
  });

  game.drawLevel();
  game.drawMoney();
  game.drawRecipes();
  game.recipeWidth = $('#recipeList li:first').width() - 2 /*border*/;

  $('#experienceBarText').hover(
    function() {
      game.experienceShown = true;
      $(this).text(game.getPlayerExperienceText())
    },
    function() {
      game.experienceShown = false;
      $(this).text(game.getPlayerLevelText())
    }
  );

  $('#durability').hide();
  $('#gatherLink').click(function(e) { e.preventDefault(); });
    
  $('#keepHelp').click(function(e)
  {
    e.preventDefault();
    var left = $(this).position().left;
    var top = $(this).position().top + 20;

    $('#keepHelpTooltip').css('left', left).css('top', top).show();
  });
  
  $('#keepHelpClose').click(function(e)
  {
    e.preventDefault();
    $('#keepHelpTooltip').hide();
    $('#keepHelp').hide();
  });
  
  $('#sellAll').click(function(e)
  {
    e.preventDefault();
    game.player.sellAllItems();
    game.updateUI();
  });
});

$(document).keypress(function(e) {
  if ($('#craftAmount').is(':focus') || $('.keep').is(':focus')) {
    return;
  }

  e.preventDefault(); // Prevent page down on hitting space bar
  if (e.which == 32) { // space
    game.craft($('#craftAmount').val())
  }
  else if (e.which  == 65 || e.which == 97) { // '[Aa]'
    game.craftAll();
  }
  else if (e.which == 71 || e.which == 103) { // '[Gg]'
    game.step();
  }
  else if (e.which >= 49 && e.which <= 57) { // '[1-9]'
    var amount = e.which - 48;
    var $current = $('#recipeList li.selectedRecipe');
    if ($current.length > 0) {
      var g = window.game;
      var item = $current.data();
      g.craftRecipe(item, amount);
    }
  }
});