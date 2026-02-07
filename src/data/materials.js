// src/data/materials.js
import Papa from "papaparse";

export const materials = [
  {
    id: "duplex_outlet",
    name: "Duplex Outlet",
    category: "Devices",
    unit: "ea",
    baseCost: 0.75,
    laborHours: 0.75
  }
];

export function loadMaterials(csvText) {
  return new Promise((resolve) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      }
    });
  });
}
