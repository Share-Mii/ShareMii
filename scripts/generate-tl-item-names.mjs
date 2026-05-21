/**
 * Builds src/data/tlItemNames.ts from Tomodachi Life RomFS docs:
 * - Outfits: Google Sheet "Clothing" tab (File ID → XX00 hex)
 * - Hats: PowerSaves / TLSE shop order (sequential index → XX00 hex)
 *
 * @see https://docs.google.com/spreadsheets/d/1xyYPsnVfDtyXUgtikBvT1LjbXLszFwasl0S3Srl1fFA
 */
import { writeFileSync } from 'fs';

const CLOTHING_SHEET_GID = '1739457472';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/1xyYPsnVfDtyXUgtikBvT1LjbXLszFwasl0S3Srl1fFA/export?format=csv&gid=${CLOTHING_SHEET_GID}`;

/** PowerSaves hat list order (maps hat index 1..N to hex NN00). */
const HATS = [
  'Floppy hat', 'Short chef hat', 'Hunting cap', 'Leather cap', 'Logo baseball cap',
  'Trucker hat', 'Striped fuzzy hat', 'Newsboy cap', 'Beret', 'Brimmed bobble hat',
  'Checkered hat', 'Denim cap', 'Polka-dot hat', 'Sequined hat', 'Slouch hat',
  'Starry top hat', 'Straw ten-gallon hat', 'Tulip hat', 'Woven straw hat', 'Beanie',
  'Reindeer bobble hat', 'Brimmed woolly hat', 'Hat with ear flaps', 'Hat with ears',
  'Ski hat & goggles', 'Trilby hat', 'Acorn hat', 'Street-style hat', 'Camo hat',
  'Reggae hat', 'Party hat', 'Fighter-pilot hat', 'Boater hat', 'Bowler hat',
  'Graduation cap', 'Russian hat', 'Ten-gallon hat', 'Top hat', 'Cloche',
  'Propeller hat', 'Nightcap', 'Paper hat', 'Swimming cap', "Children's hat",
  'Bicycle helmet', 'Sombrero', 'Colorful cap', 'Work hat', 'Cake hat', 'Frog hat',
  'Leprechaun hat', 'Dutch bonnet', 'Flamenco hat', 'Classic nightcap', 'Fez',
  'Mandarin hat', 'Safety helmet', 'Conical hat', 'Paper crown', 'Regal crown',
  'Puffball beanie', 'Striped wool hat', 'Bandana', 'Towel bandana', 'Feather hat',
  'Hand-knit wool hat', 'Multicolor cap', 'Chino bucket hat', 'Straw hat',
  'Garlic wig', 'Headscarf', 'Mohawk wig', 'Helmet', 'Motorcycle helmet',
  'Unknown hero mask', 'Ice-cream hat', 'Fried-prawn hat', 'Glam-rock wig',
  'Pompadour wig', 'Bonnet', 'Silk bandana', 'Horse mask', 'Chinese lion mask',
  'Monkey hat', 'Rabbit hat', 'Fish hat', 'Comb-over wig', 'Judge wig', 'Kaffiyeh',
  'Pirate scarf', 'Turban', 'Skull mask', 'Geisha wig', 'Ronin wig', 'Samurai wig',
  'Broccoli hat', 'Mushroom hat', 'Strawberry hat', 'Pumpkin hat', 'Curly-locks wig',
  'Scary mask', 'Bed hair', 'Flower', 'Tiny flag', 'Bunny headband', 'Ear muffs',
  'Rose barrette', 'Small ribbons', 'Sunflower barrette', 'Rhinoceros horn',
  'Apple bob', 'Star sunglasses', 'UFO', 'Floral fascinator',
  'Fancy feather hairpiece', 'Mini top hat', 'Headphones', 'Flower headband',
  'Phantom mask', 'Cat-ears headband', 'Shell barrette', 'Headset', 'Huge ribbon',
  'Spiky ponytail', 'Ribbon headband', 'Ram horns', 'Masquerade mask', 'Double horns',
  'Horn', 'Hair-bun covers', 'Rabbit-ear ribbons', 'Eye patch', 'Laurel wreath',
  'Headband', 'Neon sun visor', 'Sport visor', 'Skull barrette', 'Pom-pom barrette',
  'Jewel barrette', 'Leather barrette', 'Triangle barrette', 'Bear barrette',
  'Rabbit barrette', 'Mushroom barrette', 'Apple barrette', 'Flower barrette',
  'Heart barrette', 'Star barrette', 'Tribal feather', 'Faux-fur headband',
  'Fascinator', 'Antenna', 'Big ribbon', 'Sunglasses', 'Mini ten-gallon hat',
  'Goggles', 'Hibiscus barrette',
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || (c === '\r' && text[i + 1] === '\n')) {
      row.push(field);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
      if (c === '\r') i++;
    } else if (c !== '\r') {
      field += c;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  return rows;
}

/** Mii clothing field: 16-bit value = (fileId << 8) | color; color 00 → XX00. */
function fileIdToHex(fileId) {
  const id = Number(fileId);
  if (!Number.isFinite(id) || id < 0) return null;
  const value = (id << 8) & 0xffff;
  return value.toString(16).toUpperCase().padStart(4, '0');
}

function isTruthyRegionFlag(value) {
  return String(value ?? '').trim().toUpperCase() === 'TRUE';
}

function buildOutfitMapFromSheet(rows) {
  const header = rows[0] ?? [];
  const nameIdx = header.findIndex((h) => /clothes name/i.test(h));
  const fileIdIdx = header.findIndex((h) => /file id/i.test(h));
  const usIdx = header.findIndex((h) => /is in us/i.test(h));

  if (nameIdx === -1 || fileIdIdx === -1) {
    throw new Error('Clothing CSV missing expected columns (Clothes Name, File ID)');
  }

  const candidates = new Map();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawName = (row[nameIdx] ?? '').trim();
    const rawId = (row[fileIdIdx] ?? '').trim();
    if (!rawName || !rawId) continue;

    const fileId = Number(rawId);
    if (!Number.isFinite(fileId)) continue;

    const hex = fileIdToHex(fileId);
    if (!hex) continue;

    const inUs = usIdx === -1 ? true : isTruthyRegionFlag(row[usIdx]);
    const list = candidates.get(hex) ?? [];
    list.push({ name: rawName, fileId, inUs });
    candidates.set(hex, list);
  }

  const map = {};

  for (const [hex, entries] of candidates) {
    const usEntries = entries.filter((e) => e.inUs);
    const pickFrom = usEntries.length > 0 ? usEntries : entries;
    const preferred =
      pickFrom.find((e) => e.fileId === 0) ??
      pickFrom.find((e) => /regular clothes/i.test(e.name)) ??
      pickFrom[0];
    map[hex] = preferred.name;
  }

  map['0000'] = map['0000'] ?? 'Regular clothes';
  return map;
}

function buildHatMap(items) {
  const map = {};
  items.forEach((name, i) => {
    const hex = fileIdToHex(i + 1);
    if (hex) map[hex] = name;
  });
  map['FFFF'] = 'No hat';
  return map;
}

async function fetchClothingCsv() {
  const res = await fetch(SHEET_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch clothing sheet (${res.status})`);
  }
  return res.text();
}

const csvText = await fetchClothingCsv();
const rows = parseCsv(csvText);
const outfitNames = buildOutfitMapFromSheet(rows);
const hatNames = buildHatMap(HATS);

const out = `export const TL_OUTFIT_NAMES: Record<string, string> = ${JSON.stringify(outfitNames, null, 2)};

export const TL_HAT_NAMES: Record<string, string> = ${JSON.stringify(hatNames, null, 2)};
`;

writeFileSync(new URL('../src/data/tlItemNames.ts', import.meta.url), out);
console.log('Wrote src/data/tlItemNames.ts');
console.log(`  outfits: ${Object.keys(outfitNames).length} entries`);
console.log(`  hats: ${Object.keys(hatNames).length} entries`);
console.log('  outfit[0400]', outfitNames['0400']);
console.log('  outfit[2400]', outfitNames['2400']);
console.log('  outfit[DB00]', outfitNames['DB00']);
console.log('  hat[0100]', hatNames['0100']);
