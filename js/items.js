var ItemType = {
  Pick : "Pick",
  Forge: "Forge"
}

improveForge = function(newForge, oldForge, multiplier) {
  multiplier = multiplier || 1.5;
  newForge.level = oldForge.level + 1;
  for (var prop in oldForge.SmeltModifiers) {
    if(oldForge.SmeltModifiers.hasOwnProperty(prop)) {
      newForge.SmeltModifiers[prop] = oldForge.SmeltModifiers[prop] * multiplier;
    }
  }
}

improvePick = function(newPick, oldPick) {
  newPick.level = oldPick.level + 1;
  newPick.durability = oldPick.durability * 2;
  for (var prop in oldPick.LootModifiers) {
    if(oldPick.LootModifiers.hasOwnProperty(prop)) {
      newPick.LootModifiers[prop] = oldPick.LootModifiers[prop];
    }
  }
}

determineUnlocks = function(item) {
  if (item.Recipe.unlockedBy) {
    if (!item.Recipe.unlockedBy.unlocks) {
      item.Recipe.unlockedBy.unlocks = [];
    }

    item.Recipe.unlockedBy.unlocks.push(item.name.replace(/ /g, ''));
    delete item.Recipe.unlockedBy;
  }
}

determineTotalRequirements = function(item) {
  item.Recipe.TotalRequirements = item.Recipe.TotalRequirements || {};
  for (var i = 0; i < item.Recipe.Requirements.length; i++) {
    var req = item.Recipe.Requirements[i];
    var subItem = req.resource;

    if (!subItem.Recipe) {
      // Resources don't have recipes.
      if (item.Recipe.TotalRequirements[subItem.name]) {
        item.Recipe.TotalRequirements[subItem.name] += req.amount;
      }
      else {
        item.Recipe.TotalRequirements[subItem.name] = req.amount;
      }
    }
    else {
      // We've already determined the total requirements of the recipe item.
      // Let's merge them with total requirements of the parent item.
      for (var prop in subItem.Recipe.TotalRequirements) {
        if (subItem.Recipe.TotalRequirements.hasOwnProperty(prop)) {
          var subReqAmount = subItem.Recipe.TotalRequirements[prop];
          if (item.Recipe.TotalRequirements[prop]) {
            item.Recipe.TotalRequirements[prop] += req.amount * subReqAmount;
          }
          else {
            item.Recipe.TotalRequirements[prop] = req.amount * subReqAmount;
          }
        }
      }
    }
  }
}

determineItemComplexity = function(item) {
  item.complexity = item.complexity || 0;

  // An item's complexity is simply the depth of its recipe's dependency tree.
  // Example: 0 -- Raw resources. They don't have recipes.
  // Example: 1 -- Recipes consisting entirely of raw resources: Basic Forge (requires only Stone)
  // Example: 2 -- Recipes with at least one level 1 requirement: Sturdy Forge (since it requires 4 Basic Forges)
  // Example: 3 -- Recipes with at least one level 2 requirement: Great Forge (since it requires 4 Sturdy Forges)
  for (var i = 0; i < item.Recipe.Requirements.length; i++) {
    var req = item.Recipe.Requirements[i];
    if (typeof req.resource.complexity === "undefined" && !req.resource.Recipe) {
      req.resource.complexity = 0;
    }

    item.complexity = Math.max(item.complexity, 1 + req.resource.complexity);
  }
}

determineMakes = function(item) {
  if (item.Recipe && !item.Recipe.makes) {
    item.Recipe.makes = 1;
  }
}

var Items = {};

Items.Stick = {
  name: "Stick",
  Recipe: {
    level: 0,
    craftTime: 1,
    available: true,
    Requirements:
    [
      { resource: Resources.Wood, amount: 2 }
    ]
  }
}

Items.CopperBar = {
  name: "Copper Bar",
  Recipe: {
    craftTime: 3,
    Requirements:
    [
      { resource: Resources.CopperOre, amount: 1 },
      { resource: Resources.Coal, amount: 1 },
    ]
  }
}

Items.IronBar = {
  name: "Iron Bar",
  Recipe: {
    craftTime: 3,
    Requirements:
    [
      { resource: Resources.IronOre, amount: 1 },
      { resource: Resources.Coal, amount: 1 },
    ]
  }
}

Items.TinBar = {
  name: "Tin Bar",
  Recipe: {
    craftTime: 3,
    Requirements:
    [
      { resource: Resources.TinOre, amount: 1 },
      { resource: Resources.Coal, amount: 1 },
    ]
  }
}

Items.GoldBar = {
  name: "Gold Bar",
  Recipe: {
    craftTime: 3,
    Requirements:
    [
      { resource: Resources.GoldOre, amount: 1 },
      { resource: Resources.Coal, amount: 1 },
    ]
  }
}

Items.BronzeBar = {
  name: "Bronze Bar",
  Recipe: {
    craftTime: 3,
    Requirements:
    [
      { resource: Items.TinBar, amount: 1 },
      { resource: Items.CopperBar, amount: 1 },
      { resource: Resources.Coal, amount: 1 },
    ]
  }
}

Items.BronzeRivet = {
  name: "Bronze Rivet",
  Recipe: {
    craftTime: 16,
    makes: 16,
    Requirements:
    [
      { resource: Items.BronzeBar, amount: 1 },
    ]
  }
}

Items.SteelBar = {
  name: "Steel Bar",
  Recipe: {
    craftTime: 3,
    Requirements:
    [
      { resource: Items.IronBar, amount: 1 },
      { resource: Resources.Coal, amount: 1 },
    ]
  }
}

Items.AluminumBar = {
  name: "Aluminum Bar",
  Recipe: {
    craftTime: 3,
    makes: 2,
    Requirements:
    [
      { resource: Resources.BauxiteOre, amount: 1 },
      { resource: Resources.IronOre, amount: 1 },
      { resource: Resources.Coal, amount: 1 },
    ]
  }
}

Items.AluminumStrips = {
  name: "Aluminum Strips",
  Recipe: {
    craftTime: 8,
    makes: 8,
    Requirements:
    [
      { resource: Items.AluminumBar, amount: 1 },
    ]
  }
}

Items.LeadBar = {
  name: "Lead Bar",
  Recipe: {
    craftTime: 3,
    Requirements:
    [
      { resource: Resources.LeadOre, amount: 3 },
      { resource: Resources.Coal, amount: 1 },
    ]
  }
}

Items.WoodenPick = {
  type: ItemType.Pick,
  level: 1,
  durability: 64,
  name: "Wooden Pick",
  image: 'images/pick-wooden.png',
  LootModifiers: {},
  Recipe: {
    text: "Allows for gathering Stone and Coal.",
    unlockedBy: Items.Stick,
    craftTime: 2,
    Requirements:
    [
      { resource: Items.Stick, amount: 2 },
      { resource: Resources.Wood, amount: 3 }
    ]
  }
}
Items.WoodenPick.LootModifiers[Resources.Coal.name] = 1;
Items.WoodenPick.LootModifiers[Resources.Stone.name] = 1;

Items.StonePick = {
  type: ItemType.Pick,
  name: "Stone Pick",
  image: 'images/pick-stone.png',
  LootModifiers: {},
  Recipe: {
    text: "Allows for gathering Iron and Copper ore.",
    unlockedBy: Items.WoodenPick,
    craftTime: 3,
    Requirements:
    [
        { resource: Items.Stick, amount: 2 },
        { resource: Resources.Stone, amount: 3 }
    ]
  }
}
improvePick(Items.StonePick, Items.WoodenPick);
Items.StonePick.LootModifiers[Resources.CopperOre.name] = 1;
Items.StonePick.LootModifiers[Resources.IronOre.name] = 1;

Items.CastIronPick = {
  type: ItemType.Pick,
  name: "Cast Iron Pick",
  image: 'images/pick-cast-iron.png',
  LootModifiers: {},
  Recipe: {
    text: "Allows for gathering Gold and Tin ore.",
    unlockedBy: Items.StonePick,
    craftTime: 3,
    Requirements:
    [
        { resource: Items.Stick, amount: 2 },
        { resource: Items.IronBar, amount: 3 }
    ]
  }
}
improvePick(Items.CastIronPick, Items.StonePick);
Items.CastIronPick.LootModifiers[Resources.TinOre.name] = 1;
Items.CastIronPick.LootModifiers[Resources.GoldOre.name] = 1;

Items.GoldPick = {
  type: ItemType.Pick,
  name: "Gold Pick",
  image: 'images/pick-gold.png',
  LootModifiers: {},
  Recipe: {
    text: "Allows for gathering Bauxite ore.",
    unlockedBy: Items.CastIronPick,
    craftTime: 3,
    Requirements:
    [
        { resource: Items.Stick, amount: 2 },
        { resource: Items.GoldBar, amount: 3 }
    ]
  }
}
improvePick(Items.GoldPick, Items.CastIronPick);
Items.GoldPick.LootModifiers[Resources.BauxiteOre.name] = 1;

Items.SteelPick = {
  type: ItemType.Pick,
  name: "Steel Pick",
  image: 'images/pick-steel.png',
  LootModifiers: {},
  Recipe: {
    text: "Allows for gathering Lead ore.",
    unlockedBy: Items.GoldPick,
    craftTime: 12,
    Requirements:
    [
        { resource: Items.Stick, amount: 2 },
        { resource: Items.SteelBar, amount: 3 },
        { resource: Items.BronzeRivet, amount: 4 },
        { resource: Items.AluminumStrips, amount: 8 },
    ]
  }
}
improvePick(Items.SteelPick, Items.GoldPick);
Items.SteelPick.LootModifiers[Resources.LeadOre.name] = 1;

Items.CopperBar.Recipe.unlockedBy = Items.StonePick;
Items.IronBar.Recipe.unlockedBy = Items.StonePick;
Items.TinBar.Recipe.unlockedBy = Items.CastIronPick;
Items.GoldBar.Recipe.unlockedBy = Items.CastIronPick;
Items.SteelBar.Recipe.unlockedBy = Items.GoldPick;
Items.BronzeBar.Recipe.unlockedBy = Items.GoldPick;
Items.BronzeRivet.Recipe.unlockedBy = Items.GoldPick;
Items.AluminumBar.Recipe.unlockedBy = Items.GoldPick;
Items.AluminumStrips.Recipe.unlockedBy = Items.GoldPick;
Items.LeadBar.Recipe.unlockedBy = Items.SteelPick;

Items.BasicForge = {
  type: ItemType.Forge,
  level: 1,
  name: "Basic Forge",
  SmeltModifiers: {},
  Recipe: {
    text: "Smelts Iron and Copper ores.",
    unlockedBy: Items.WoodenPick,
    craftTime: 8,
    Requirements:
    [
      { resource: Resources.Stone, amount: 24 }
    ]
  }
}
Items.BasicForge.SmeltModifiers[Items.CopperBar.name] = 1;
Items.BasicForge.SmeltModifiers[Items.IronBar.name] = 1;

Items.SturdyForge = {
  type: ItemType.Forge,
  name: "Sturdy Forge",
  SmeltModifiers: {},
  Recipe: {
    text: "Smelts Tin and Gold ores. Smelts lesser ores 50% faster than the Basic Forge.",
    unlockedBy: Items.StonePick,
    craftTime: 15,
    Requirements:
    [
      { resource: Items.IronBar, amount: 8 },
      { resource: Items.CopperBar, amount: 8 },
      { resource: Items.BasicForge, amount: 1 }
    ]
  }
}
improveForge(Items.SturdyForge, Items.BasicForge);
Items.SturdyForge.SmeltModifiers[Items.GoldBar.name] = 1;
Items.SturdyForge.SmeltModifiers[Items.TinBar.name] = 1;

Items.GreatForge = {
  type: ItemType.Forge,
  name: "Great Forge",
  SmeltModifiers: {},
  Recipe: {
    text: "Smelts Aluminum ore and Bronze and Steel bars. Smelts lesser ores 50% faster than the Sturdy Forge.",
    unlockedBy: Items.CastIronPick,
    craftTime: 30,
    Requirements:
    [
      { resource: Items.IronBar, amount: 16 },
      { resource: Items.CopperBar, amount: 16 },
      { resource: Items.GoldBar, amount: 8 },
      { resource: Items.SturdyForge, amount: 1 }
    ]
  }
}
improveForge(Items.GreatForge, Items.SturdyForge);
Items.GreatForge.SmeltModifiers[Items.SteelBar.name] = 1;
Items.GreatForge.SmeltModifiers[Items.AluminumBar.name] = 1;
Items.GreatForge.SmeltModifiers[Items.BronzeBar.name] = 1;

Items.GiantForge = {
  type: ItemType.Forge,
  name: "Giant Forge",
  SmeltModifiers: {},
  Recipe: {
    text: "Smelts Lead ore. Smelts lesser ores 50% faster than the Sturdy Forge.",
    unlockedBy: Items.CastIronPick,
    craftTime: 60,
    Requirements:
    [
      { resource: Items.IronBar, amount: 32 },
      { resource: Items.CopperBar, amount: 32 },
      { resource: Items.GoldBar, amount: 16 },
      { resource: Items.BronzeBar, amount: 8 },
      { resource: Items.AluminumBar, amount: 8 },
      { resource: Items.SteelBar, amount: 8 },
      { resource: Items.GreatForge, amount: 1 }
    ]
  }
}
improveForge(Items.GiantForge, Items.GreatForge);
Items.GreatForge.SmeltModifiers[Items.LeadBar.name] = 1;

Items.CopperBar.Recipe.forge = Items.BasicForge;
Items.IronBar.Recipe.forge = Items.BasicForge;
Items.TinBar.Recipe.forge = Items.SturdyForge;
Items.GoldBar.Recipe.forge = Items.SturdyForge;
Items.BronzeBar.Recipe.forge = Items.GreatForge;
Items.AluminumBar.Recipe.forge = Items.GreatForge;
Items.SteelBar.Recipe.forge = Items.GreatForge;
Items.LeadBar.Recipe.forge = Items.GiantForge;

for (var prop in Items) {
  if (Items.hasOwnProperty(prop)) {
    var item = Items[prop];
    determineUnlocks(item);
    determineTotalRequirements(item);
    determineItemComplexity(item);
    determineMakes(item);
  }
}