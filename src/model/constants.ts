export const BIOME_PALETTE: [number, number, number][] = [
  [0, 0, 128],   // ocean
  [194, 178, 128], // beach
  [34, 139, 34], // forest
  // ...
];

export enum Biome {
  Ocean = 0,
  Beach,
  Desert,
  Savanna,
  Grassland,
  Shrubland,
  TemperateForest,
  BorealForest,
  Rainforest,
  Tundra,
  Mountain,
  Snow,
}