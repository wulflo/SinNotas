export interface ChemicalElement {
  z: number;
  symbol: string;
  name: string;
  neutrons: number;
}

/** Most common isotope neutrons for Z = 1..118. */
export const CHEMICAL_ELEMENTS: ChemicalElement[] = [
  { z: 1, symbol: "H", name: "Hidrógeno", neutrons: 0 },
  { z: 2, symbol: "He", name: "Helio", neutrons: 2 },
  { z: 3, symbol: "Li", name: "Litio", neutrons: 4 },
  { z: 4, symbol: "Be", name: "Berilio", neutrons: 5 },
  { z: 5, symbol: "B", name: "Boro", neutrons: 6 },
  { z: 6, symbol: "C", name: "Carbono", neutrons: 6 },
  { z: 7, symbol: "N", name: "Nitrógeno", neutrons: 7 },
  { z: 8, symbol: "O", name: "Oxígeno", neutrons: 8 },
  { z: 9, symbol: "F", name: "Flúor", neutrons: 10 },
  { z: 10, symbol: "Ne", name: "Neón", neutrons: 10 },
  { z: 11, symbol: "Na", name: "Sodio", neutrons: 12 },
  { z: 12, symbol: "Mg", name: "Magnesio", neutrons: 12 },
  { z: 13, symbol: "Al", name: "Aluminio", neutrons: 14 },
  { z: 14, symbol: "Si", name: "Silicio", neutrons: 14 },
  { z: 15, symbol: "P", name: "Fósforo", neutrons: 16 },
  { z: 16, symbol: "S", name: "Azufre", neutrons: 16 },
  { z: 17, symbol: "Cl", name: "Cloro", neutrons: 18 },
  { z: 18, symbol: "Ar", name: "Argón", neutrons: 22 },
  { z: 19, symbol: "K", name: "Potasio", neutrons: 20 },
  { z: 20, symbol: "Ca", name: "Calcio", neutrons: 20 },
  { z: 21, symbol: "Sc", name: "Escandio", neutrons: 24 },
  { z: 22, symbol: "Ti", name: "Titanio", neutrons: 26 },
  { z: 23, symbol: "V", name: "Vanadio", neutrons: 28 },
  { z: 24, symbol: "Cr", name: "Cromo", neutrons: 28 },
  { z: 25, symbol: "Mn", name: "Manganeso", neutrons: 30 },
  { z: 26, symbol: "Fe", name: "Hierro", neutrons: 30 },
  { z: 27, symbol: "Co", name: "Cobalto", neutrons: 32 },
  { z: 28, symbol: "Ni", name: "Níquel", neutrons: 30 },
  { z: 29, symbol: "Cu", name: "Cobre", neutrons: 34 },
  { z: 30, symbol: "Zn", name: "Cinc", neutrons: 34 },
  { z: 31, symbol: "Ga", name: "Galio", neutrons: 39 },
  { z: 32, symbol: "Ge", name: "Germanio", neutrons: 42 },
  { z: 33, symbol: "As", name: "Arsénico", neutrons: 42 },
  { z: 34, symbol: "Se", name: "Selenio", neutrons: 46 },
  { z: 35, symbol: "Br", name: "Bromo", neutrons: 44 },
  { z: 36, symbol: "Kr", name: "Kriptón", neutrons: 48 },
  { z: 37, symbol: "Rb", name: "Rubidio", neutrons: 48 },
  { z: 38, symbol: "Sr", name: "Estroncio", neutrons: 50 },
  { z: 39, symbol: "Y", name: "Itrio", neutrons: 50 },
  { z: 40, symbol: "Zr", name: "Circonio", neutrons: 50 },
  { z: 41, symbol: "Nb", name: "Niobio", neutrons: 52 },
  { z: 42, symbol: "Mo", name: "Molibdeno", neutrons: 54 },
  { z: 43, symbol: "Tc", name: "Tecnecio", neutrons: 55 },
  { z: 44, symbol: "Ru", name: "Rutenio", neutrons: 58 },
  { z: 45, symbol: "Rh", name: "Rodio", neutrons: 58 },
  { z: 46, symbol: "Pd", name: "Paladio", neutrons: 60 },
  { z: 47, symbol: "Ag", name: "Plata", neutrons: 60 },
  { z: 48, symbol: "Cd", name: "Cadmio", neutrons: 66 },
  { z: 49, symbol: "In", name: "Indio", neutrons: 66 },
  { z: 50, symbol: "Sn", name: "Estaño", neutrons: 70 },
  { z: 51, symbol: "Sb", name: "Antimonio", neutrons: 70 },
  { z: 52, symbol: "Te", name: "Telurio", neutrons: 78 },
  { z: 53, symbol: "I", name: "Yodo", neutrons: 74 },
  { z: 54, symbol: "Xe", name: "Xenón", neutrons: 77 },
  { z: 55, symbol: "Cs", name: "Cesio", neutrons: 78 },
  { z: 56, symbol: "Ba", name: "Bario", neutrons: 81 },
  { z: 57, symbol: "La", name: "Lantano", neutrons: 82 },
  { z: 58, symbol: "Ce", name: "Cerio", neutrons: 82 },
  { z: 59, symbol: "Pr", name: "Praseodimio", neutrons: 82 },
  { z: 60, symbol: "Nd", name: "Neodimio", neutrons: 84 },
  { z: 61, symbol: "Pm", name: "Prometio", neutrons: 84 },
  { z: 62, symbol: "Sm", name: "Samario", neutrons: 88 },
  { z: 63, symbol: "Eu", name: "Europio", neutrons: 89 },
  { z: 64, symbol: "Gd", name: "Gadolinio", neutrons: 93 },
  { z: 65, symbol: "Tb", name: "Terbio", neutrons: 94 },
  { z: 66, symbol: "Dy", name: "Disprosio", neutrons: 97 },
  { z: 67, symbol: "Ho", name: "Holmio", neutrons: 98 },
  { z: 68, symbol: "Er", name: "Erbio", neutrons: 99 },
  { z: 69, symbol: "Tm", name: "Tulio", neutrons: 100 },
  { z: 70, symbol: "Yb", name: "Iterbio", neutrons: 103 },
  { z: 71, symbol: "Lu", name: "Lutecio", neutrons: 104 },
  { z: 72, symbol: "Hf", name: "Hafnio", neutrons: 106 },
  { z: 73, symbol: "Ta", name: "Tántalo", neutrons: 108 },
  { z: 74, symbol: "W", name: "Wolframio", neutrons: 110 },
  { z: 75, symbol: "Re", name: "Renio", neutrons: 111 },
  { z: 76, symbol: "Os", name: "Osmio", neutrons: 114 },
  { z: 77, symbol: "Ir", name: "Iridio", neutrons: 115 },
  { z: 78, symbol: "Pt", name: "Platino", neutrons: 117 },
  { z: 79, symbol: "Au", name: "Oro", neutrons: 118 },
  { z: 80, symbol: "Hg", name: "Mercurio", neutrons: 121 },
  { z: 81, symbol: "Tl", name: "Talio", neutrons: 123 },
  { z: 82, symbol: "Pb", name: "Plomo", neutrons: 126 },
  { z: 83, symbol: "Bi", name: "Bismuto", neutrons: 126 },
  { z: 84, symbol: "Po", name: "Polonio", neutrons: 125 },
  { z: 85, symbol: "At", name: "Astato", neutrons: 125 },
  { z: 86, symbol: "Rn", name: "Radón", neutrons: 136 },
  { z: 87, symbol: "Fr", name: "Francio", neutrons: 136 },
  { z: 88, symbol: "Ra", name: "Radio", neutrons: 138 },
  { z: 89, symbol: "Ac", name: "Actinio", neutrons: 138 },
  { z: 90, symbol: "Th", name: "Torio", neutrons: 142 },
  { z: 91, symbol: "Pa", name: "Protactinio", neutrons: 140 },
  { z: 92, symbol: "U", name: "Uranio", neutrons: 146 },
  { z: 93, symbol: "Np", name: "Neptunio", neutrons: 144 },
  { z: 94, symbol: "Pu", name: "Plutonio", neutrons: 150 },
  { z: 95, symbol: "Am", name: "Americio", neutrons: 148 },
  { z: 96, symbol: "Cm", name: "Curio", neutrons: 151 },
  { z: 97, symbol: "Bk", name: "Berkelio", neutrons: 150 },
  { z: 98, symbol: "Cf", name: "Californio", neutrons: 153 },
  { z: 99, symbol: "Es", name: "Einstenio", neutrons: 153 },
  { z: 100, symbol: "Fm", name: "Fermio", neutrons: 157 },
  { z: 101, symbol: "Md", name: "Mendelevio", neutrons: 157 },
  { z: 102, symbol: "No", name: "Nobelio", neutrons: 157 },
  { z: 103, symbol: "Lr", name: "Lawrencio", neutrons: 159 },
  { z: 104, symbol: "Rf", name: "Rutherfordio", neutrons: 163 },
  { z: 105, symbol: "Db", name: "Dubnio", neutrons: 163 },
  { z: 106, symbol: "Sg", name: "Seaborgio", neutrons: 163 },
  { z: 107, symbol: "Bh", name: "Bohrio", neutrons: 163 },
  { z: 108, symbol: "Hs", name: "Hasio", neutrons: 169 },
  { z: 109, symbol: "Mt", name: "Meitnerio", neutrons: 169 },
  { z: 110, symbol: "Ds", name: "Darmstadtio", neutrons: 171 },
  { z: 111, symbol: "Rg", name: "Roentgenio", neutrons: 171 },
  { z: 112, symbol: "Cn", name: "Copernicio", neutrons: 173 },
  { z: 113, symbol: "Nh", name: "Nihonio", neutrons: 173 },
  { z: 114, symbol: "Fl", name: "Flerovio", neutrons: 175 },
  { z: 115, symbol: "Mc", name: "Moscovio", neutrons: 175 },
  { z: 116, symbol: "Lv", name: "Livermorio", neutrons: 177 },
  { z: 117, symbol: "Ts", name: "Teneso", neutrons: 177 },
  { z: 118, symbol: "Og", name: "Oganesón", neutrons: 176 },
];

export interface MoleculeAtom {
  /** Símbolo químico que se dibuja dentro del átomo (H, C, N, O, P...). */
  el: string;
  x: number;
  y: number;
  r?: number;
}

export interface MoleculeBond {
  a: number;
  b: number;
  order?: 1 | 2 | 3;
}

export interface MoleculeStage {
  id: string;
  name: string;
  formula: string;
  /** Puntos mínimos para alcanzar esta molécula. */
  minPoints: number;
  atoms: MoleculeAtom[];
  bonds: MoleculeBond[];
}

export type ProgressStage =
  | { kind: "proton"; points: number }
  | { kind: "element"; points: number; element: ChemicalElement }
  | { kind: "molecule"; points: number; molecule: MoleculeStage };

function ringAtoms(
  cx: number,
  cy: number,
  radius: number,
  labels: string[],
  startDegrees = -90
): MoleculeAtom[] {
  return labels.map((el, index) => {
    const angle = ((startDegrees + (360 / labels.length) * index) * Math.PI) / 180;
    return {
      el,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

function ringBonds(count: number, offset = 0, doubleEvery = 0): MoleculeBond[] {
  return Array.from({ length: count }, (_, index) => {
    const order: 1 | 2 = doubleEvery > 0 && index % doubleEvery === 0 ? 2 : 1;
    return {
      a: offset + index,
      b: offset + ((index + 1) % count),
      order,
    };
  });
}

/* ---------- Moléculas clásicas (esquemas ball-and-stick) ---------- */

const benzeneAtoms: MoleculeAtom[] = [
  ...ringAtoms(80, 70, 30, ["C", "C", "C", "C", "C", "C"]),
  ...ringAtoms(80, 70, 47, ["H", "H", "H", "H", "H", "H"]),
];

const glucoseRing = ringAtoms(80, 66, 27, ["O", "C", "C", "C", "C", "C"]);
const glucoseOxygens: MoleculeAtom[] = [1, 2, 3, 4, 5].map((index) => {
  const angle = ((-90 + index * 60) * Math.PI) / 180;
  return {
    el: "O",
    x: 80 + 45 * Math.cos(angle),
    y: 66 + 45 * Math.sin(angle),
    r: 8,
  };
});

const adenineSix = ringAtoms(66, 70, 22, ["N", "C", "N", "C", "C", "C"]);
const adenineFive = ringAtoms(98, 70, 18, ["C", "N", "C", "N", "C"]);

const atpSix = ringAtoms(42, 64, 13, ["N", "C", "N", "C", "C", "C"]);
const atpFive = ringAtoms(62, 64, 11, ["C", "N", "C", "N", "C"]);
const atpRibose = ringAtoms(84, 76, 12, ["C", "C", "C", "C", "O"]);

const dnaAtoms: MoleculeAtom[] = [];
const dnaBonds: MoleculeBond[] = [];
const dnaSteps = 9;
for (let index = 0; index < dnaSteps; index++) {
  const x = 32 + index * 12;
  const phase = (index / (dnaSteps - 1)) * Math.PI * 3;
  const offset = Math.sin(phase) * 24;
  dnaAtoms.push({ el: "P", x, y: 70 + offset, r: 7.5 });
  dnaAtoms.push({ el: "P", x, y: 70 - offset, r: 7.5 });
}
for (let index = 0; index < dnaSteps - 1; index++) {
  dnaBonds.push({ a: index * 2, b: (index + 1) * 2 });
  dnaBonds.push({ a: index * 2 + 1, b: (index + 1) * 2 + 1 });
}
for (let index = 0; index < dnaSteps; index++) {
  dnaBonds.push({ a: index * 2, b: index * 2 + 1 });
}

export const MOLECULE_STAGES: MoleculeStage[] = [
  {
    id: "h2",
    name: "Hidrógeno molecular",
    formula: "H₂",
    minPoints: 119,
    atoms: [
      { el: "H", x: 60, y: 70, r: 9 },
      { el: "H", x: 100, y: 70, r: 9 },
    ],
    bonds: [{ a: 0, b: 1 }],
  },
  {
    id: "water",
    name: "Agua",
    formula: "H₂O",
    minPoints: 149,
    atoms: [
      { el: "O", x: 80, y: 60, r: 12 },
      { el: "H", x: 52, y: 88, r: 7 },
      { el: "H", x: 108, y: 88, r: 7 },
    ],
    bonds: [
      { a: 0, b: 1 },
      { a: 0, b: 2 },
    ],
  },
  {
    id: "co2",
    name: "Dióxido de carbono",
    formula: "CO₂",
    minPoints: 179,
    atoms: [
      { el: "O", x: 42, y: 70, r: 10 },
      { el: "C", x: 80, y: 70, r: 11 },
      { el: "O", x: 118, y: 70, r: 10 },
    ],
    bonds: [
      { a: 0, b: 1, order: 2 },
      { a: 1, b: 2, order: 2 },
    ],
  },
  {
    id: "ammonia",
    name: "Amoníaco",
    formula: "NH₃",
    minPoints: 209,
    atoms: [
      { el: "N", x: 80, y: 60, r: 12 },
      { el: "H", x: 48, y: 92, r: 7 },
      { el: "H", x: 80, y: 104, r: 7 },
      { el: "H", x: 112, y: 92, r: 7 },
    ],
    bonds: [
      { a: 0, b: 1 },
      { a: 0, b: 2 },
      { a: 0, b: 3 },
    ],
  },
  {
    id: "methane",
    name: "Metano",
    formula: "CH₄",
    minPoints: 239,
    atoms: [
      { el: "C", x: 80, y: 72, r: 12 },
      { el: "H", x: 80, y: 34, r: 7 },
      { el: "H", x: 42, y: 84, r: 7 },
      { el: "H", x: 118, y: 84, r: 7 },
      { el: "H", x: 80, y: 112, r: 7 },
    ],
    bonds: [
      { a: 0, b: 1 },
      { a: 0, b: 2 },
      { a: 0, b: 3 },
      { a: 0, b: 4 },
    ],
  },
  {
    id: "ethanol",
    name: "Etanol",
    formula: "C₂H₅OH",
    minPoints: 269,
    atoms: [
      { el: "C", x: 46, y: 72, r: 10 },
      { el: "C", x: 74, y: 72, r: 10 },
      { el: "O", x: 102, y: 72, r: 9 },
      { el: "H", x: 26, y: 72, r: 6.5 },
      { el: "H", x: 46, y: 46, r: 6.5 },
      { el: "H", x: 46, y: 98, r: 6.5 },
      { el: "H", x: 74, y: 46, r: 6.5 },
      { el: "H", x: 74, y: 98, r: 6.5 },
      { el: "H", x: 102, y: 46, r: 6.5 },
      { el: "H", x: 122, y: 88, r: 6.5 },
    ],
    bonds: [
      { a: 0, b: 1 },
      { a: 1, b: 2 },
      { a: 3, b: 0 },
      { a: 4, b: 0 },
      { a: 5, b: 0 },
      { a: 6, b: 1 },
      { a: 7, b: 1 },
      { a: 8, b: 2 },
      { a: 9, b: 2 },
    ],
  },
  {
    id: "benzene",
    name: "Benceno",
    formula: "C₆H₆",
    minPoints: 299,
    atoms: benzeneAtoms,
    bonds: [
      ...ringBonds(6, 0, 2),
      ...Array.from({ length: 6 }, (_, index) => ({ a: index, b: index + 6 })),
    ],
  },
  {
    id: "glucose",
    name: "Glucosa",
    formula: "C₆H₁₂O₆",
    minPoints: 329,
    atoms: [...glucoseRing, ...glucoseOxygens],
    bonds: [
      ...ringBonds(6),
      ...glucoseOxygens.map((_, index) => ({ a: index + 1, b: index + 6 })),
    ],
  },
  {
    id: "glycine",
    name: "Glicina (aminoácido)",
    formula: "C₂H₅NO₂",
    minPoints: 359,
    atoms: [
      { el: "N", x: 38, y: 80, r: 10 },
      { el: "C", x: 64, y: 72, r: 10 },
      { el: "C", x: 90, y: 80, r: 10 },
      { el: "O", x: 112, y: 62, r: 9 },
      { el: "O", x: 112, y: 96, r: 9 },
      { el: "H", x: 22, y: 64, r: 6 },
      { el: "H", x: 22, y: 96, r: 6 },
      { el: "H", x: 64, y: 46, r: 6 },
      { el: "H", x: 90, y: 104, r: 6 },
    ],
    bonds: [
      { a: 0, b: 1 },
      { a: 1, b: 2 },
      { a: 2, b: 3, order: 2 },
      { a: 2, b: 4 },
      { a: 0, b: 5 },
      { a: 0, b: 6 },
      { a: 1, b: 7 },
      { a: 2, b: 8 },
    ],
  },
  {
    id: "adenine",
    name: "Adenina (base nitrogenada)",
    formula: "C₅H₅N₅",
    minPoints: 389,
    atoms: [...adenineSix, ...adenineFive],
    bonds: [...ringBonds(6, 0), ...ringBonds(5, 6)],
  },
  {
    id: "atp",
    name: "Adenosín trifosfato",
    formula: "ATP",
    minPoints: 419,
    atoms: [
      ...atpSix,
      ...atpFive,
      ...atpRibose,
      { el: "P", x: 106, y: 64, r: 9 },
      { el: "P", x: 120, y: 80, r: 9 },
      { el: "P", x: 134, y: 64, r: 9 },
      { el: "O", x: 106, y: 46, r: 7 },
      { el: "O", x: 120, y: 96, r: 7 },
      { el: "O", x: 134, y: 46, r: 7 },
    ],
    bonds: [
      ...ringBonds(6, 0),
      ...ringBonds(5, 6),
      ...ringBonds(5, 11),
      { a: 8, b: 11 },
      { a: 15, b: 16 },
      { a: 16, b: 17 },
      { a: 17, b: 18 },
      { a: 16, b: 19 },
      { a: 17, b: 20 },
      { a: 18, b: 21 },
    ],
  },
  {
    id: "peptide",
    name: "Cadena corta de aminoácidos",
    formula: "Péptido",
    minPoints: 449,
    atoms: [
      { el: "N", x: 34, y: 80, r: 10 },
      { el: "C", x: 54, y: 58, r: 10 },
      { el: "C", x: 74, y: 80, r: 10 },
      { el: "N", x: 94, y: 58, r: 10 },
      { el: "C", x: 114, y: 80, r: 10 },
      { el: "C", x: 134, y: 58, r: 10 },
      { el: "O", x: 74, y: 104, r: 8 },
      { el: "O", x: 114, y: 104, r: 8 },
    ],
    bonds: [
      { a: 0, b: 1 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
      { a: 3, b: 4 },
      { a: 4, b: 5 },
      { a: 2, b: 6, order: 2 },
      { a: 4, b: 7, order: 2 },
    ],
  },
  {
    id: "protein",
    name: "Cadena polipeptídica",
    formula: "Proteína",
    minPoints: 479,
    atoms: [
      { el: "N", x: 30, y: 86, r: 9 },
      { el: "C", x: 44, y: 54, r: 10 },
      { el: "C", x: 60, y: 84, r: 10 },
      { el: "N", x: 76, y: 50, r: 9 },
      { el: "C", x: 92, y: 82, r: 10 },
      { el: "C", x: 108, y: 48, r: 10 },
      { el: "N", x: 124, y: 78, r: 9 },
      { el: "C", x: 140, y: 54, r: 10 },
      { el: "O", x: 44, y: 32, r: 8 },
      { el: "O", x: 76, y: 28, r: 8 },
      { el: "O", x: 108, y: 26, r: 8 },
    ],
    bonds: [
      { a: 0, b: 1 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
      { a: 3, b: 4 },
      { a: 4, b: 5 },
      { a: 5, b: 6 },
      { a: 6, b: 7 },
      { a: 1, b: 8 },
      { a: 3, b: 9 },
      { a: 5, b: 10 },
    ],
  },
  {
    id: "dna",
    name: "Doble hélice",
    formula: "ADN",
    minPoints: 509,
    atoms: dnaAtoms,
    bonds: dnaBonds,
  },
  {
    id: "macromolecule",
    name: "Polímero ramificado",
    formula: "Macromolécula",
    minPoints: 539,
    atoms: [
      { el: "C", x: 28, y: 70, r: 9 },
      { el: "C", x: 46, y: 54, r: 9 },
      { el: "C", x: 64, y: 70, r: 9 },
      { el: "C", x: 82, y: 54, r: 9 },
      { el: "C", x: 100, y: 70, r: 9 },
      { el: "C", x: 118, y: 54, r: 9 },
      { el: "C", x: 136, y: 70, r: 9 },
      { el: "N", x: 44, y: 30, r: 8 },
      { el: "O", x: 66, y: 96, r: 8 },
      { el: "O", x: 84, y: 28, r: 8 },
      { el: "N", x: 102, y: 96, r: 8 },
      { el: "O", x: 120, y: 30, r: 8 },
      { el: "N", x: 140, y: 96, r: 8 },
    ],
    bonds: [
      { a: 0, b: 1 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
      { a: 3, b: 4 },
      { a: 4, b: 5 },
      { a: 5, b: 6 },
      { a: 1, b: 7 },
      { a: 2, b: 8 },
      { a: 3, b: 9 },
      { a: 4, b: 10 },
      { a: 5, b: 11 },
      { a: 6, b: 12 },
    ],
  },
];

/**
 * Progresión diaria:
 *   0 puntos  -> un protón solitario (sin electrones)
 *   1..118    -> elementos Z = 1..118
 *   119+      -> moléculas clásicas cada 30 puntos, hasta una macromolécula.
 */
export function progressStageFromPoints(points: number): ProgressStage {
  const safe = Math.max(0, Math.floor(points));
  if (safe === 0) return { kind: "proton", points: 0 };
  if (safe <= CHEMICAL_ELEMENTS.length) {
    return { kind: "element", points: safe, element: CHEMICAL_ELEMENTS[safe - 1] };
  }

  let current = MOLECULE_STAGES[0];
  for (const stage of MOLECULE_STAGES) {
    if (safe >= stage.minPoints) current = stage;
    else break;
  }
  return { kind: "molecule", points: safe, molecule: current };
}
