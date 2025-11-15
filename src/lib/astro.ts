import * as Astronomy from "astronomy-engine";

export type ChartBody =
  | "Soleil"
  | "Lune"
  | "Mercure"
  | "Vénus"
  | "Mars"
  | "Jupiter"
  | "Saturne"
  | "Uranus"
  | "Neptune"
  | "Pluton";

export interface ChartRequest {
  date: Date;
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface AngleDetail {
  id: string;
  label: string;
  longitude: number;
  sign: ZodiacInfo;
  degrees: number;
  minutes: number;
}

export interface PlanetDetail extends AngleDetail {
  body: ChartBody;
  latitude: number;
  rightAscension: number;
  declination: number;
  house: number;
}

export interface ChartComputation {
  planets: PlanetDetail[];
  ascendant: AngleDetail;
  midheaven: AngleDetail;
  imumCoeli: AngleDetail;
  descendant: AngleDetail;
  houses: AngleDetail[];
  metadata: {
    julianDay: number;
    siderealTimeHours: number;
  };
}

export interface ZodiacInfo {
  id: number;
  name: string;
  element: "Feu" | "Terre" | "Air" | "Eau";
  symbol: string;
  degreeWithinSign: number;
  minuteWithinSign: number;
}

const BODY_MAP: Record<ChartBody, Astronomy.Body> = {
  Soleil: Astronomy.Body.Sun,
  Lune: Astronomy.Body.Moon,
  Mercure: Astronomy.Body.Mercury,
  Vénus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturne: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
  Pluton: Astronomy.Body.Pluto,
};

const SIGN_DATA: { name: string; element: ZodiacInfo["element"]; symbol: string }[] =
  [
    { name: "Bélier", element: "Feu", symbol: "♈︎" },
    { name: "Taureau", element: "Terre", symbol: "♉︎" },
    { name: "Gémeaux", element: "Air", symbol: "♊︎" },
    { name: "Cancer", element: "Eau", symbol: "♋︎" },
    { name: "Lion", element: "Feu", symbol: "♌︎" },
    { name: "Vierge", element: "Terre", symbol: "♍︎" },
    { name: "Balance", element: "Air", symbol: "♎︎" },
    { name: "Scorpion", element: "Eau", symbol: "♏︎" },
    { name: "Sagittaire", element: "Feu", symbol: "♐︎" },
    { name: "Capricorne", element: "Terre", symbol: "♑︎" },
    { name: "Verseau", element: "Air", symbol: "♒︎" },
    { name: "Poissons", element: "Eau", symbol: "♓︎" },
  ];

function wrapDegrees(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function toDegreesMinutes(value: number): { degrees: number; minutes: number } {
  const degrees = Math.floor(value);
  const minutesRaw = Math.round((value - degrees) * 60);
  if (minutesRaw === 60) {
    return { degrees: degrees + 1, minutes: 0 };
  }
  return { degrees, minutes: minutesRaw };
}

function computeZodiac(longitude: number): ZodiacInfo {
  const normalized = wrapDegrees(longitude);
  const signIndex = Math.floor(normalized / 30);
  const withinSign = normalized - signIndex * 30;
  const { degrees, minutes } = toDegreesMinutes(withinSign);
  const signData = SIGN_DATA[signIndex];

  return {
    id: signIndex + 1,
    name: signData.name,
    element: signData.element,
    symbol: signData.symbol,
    degreeWithinSign: degrees,
    minuteWithinSign: minutes,
  };
}

function formatAngle(label: string, longitude: number): AngleDetail {
  const { degrees, minutes } = toDegreesMinutes(wrapDegrees(longitude));
  return {
    id: label,
    label,
    longitude: wrapDegrees(longitude),
    sign: computeZodiac(longitude),
    degrees,
    minutes,
  };
}

function computeAscendant(date: Date, observer: Astronomy.Observer): number {
  const time = Astronomy.MakeTime(date);
  const horizonVector = new Astronomy.Vector(0, -1, 0, time);
  const rotation = Astronomy.Rotation_HOR_ECL(time, observer);
  const ecliptic = Astronomy.RotateVector(rotation, horizonVector);
  return wrapDegrees(Math.atan2(ecliptic.y, ecliptic.x) * Astronomy.RAD2DEG);
}

function computeMidheaven(date: Date, longitude: number): number {
  const time = Astronomy.MakeTime(date);
  const tilt = Astronomy.e_tilt(time);
  const epsilon = tilt.tobl * Astronomy.DEG2RAD;
  const gstHours = Astronomy.SiderealTime(date);
  const lstHours = (gstHours + longitude / 15 + 24) % 24;
  const lstRad = lstHours * Math.PI / 12;
  const lon = Math.atan2(Math.sin(lstRad), Math.cos(lstRad) * Math.cos(epsilon));
  return wrapDegrees(lon * Astronomy.RAD2DEG);
}

function computePlanetPosition(
  body: ChartBody,
  date: Date,
  observer: Astronomy.Observer,
  rotation: Astronomy.RotationMatrix,
): {
  longitude: number;
  latitude: number;
  rightAscension: number;
  declination: number;
} {
  const eq = Astronomy.Equator(BODY_MAP[body], date, observer, true, true);
  const eclVector = Astronomy.RotateVector(rotation, eq.vec);
  const longitude = wrapDegrees(Math.atan2(eclVector.y, eclVector.x) * Astronomy.RAD2DEG);
  const latitude = Math.atan2(
    eclVector.z,
    Math.sqrt(eclVector.x * eclVector.x + eclVector.y * eclVector.y),
  ) * Astronomy.RAD2DEG;

  return {
    longitude,
    latitude,
    rightAscension: eq.ra * 15,
    declination: eq.dec,
  };
}

export function computeChart({
  date,
  latitude,
  longitude,
  altitude = 0,
}: ChartRequest): ChartComputation {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Date de naissance invalide.");
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("La latitude doit être comprise entre -90° et +90°.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("La longitude doit être comprise entre -180° et +180°.");
  }

  const observer = new Astronomy.Observer(latitude, longitude, altitude);
  const rotation = Astronomy.Rotation_EQD_ECL(date);
  const ascendantLongitude = computeAscendant(date, observer);
  const midheavenLongitude = computeMidheaven(date, longitude);

  const planetKeys: ChartBody[] = [
    "Soleil",
    "Lune",
    "Mercure",
    "Vénus",
    "Mars",
    "Jupiter",
    "Saturne",
    "Uranus",
    "Neptune",
    "Pluton",
  ];

  const planets: PlanetDetail[] = planetKeys.map((body) => {
    const position = computePlanetPosition(body, date, observer, rotation);
    const sign = computeZodiac(position.longitude);
    const { degrees, minutes } = toDegreesMinutes(position.longitude);
    const house =
      Math.floor(((position.longitude - ascendantLongitude + 360) % 360) / 30) + 1;

    return {
      id: body,
      label: body,
      body,
      longitude: position.longitude,
      latitude: position.latitude,
      rightAscension: position.rightAscension,
      declination: position.declination,
      sign,
      degrees,
      minutes,
      house,
    };
  });

  const houses = Array.from({ length: 12 }, (_, index) => {
    const longitudeValue = wrapDegrees(ascendantLongitude + index * 30);
    return formatAngle(`Maison ${index + 1}`, longitudeValue);
  });

  return {
    planets,
    ascendant: formatAngle("Ascendant", ascendantLongitude),
    descendant: formatAngle("Descendant", ascendantLongitude + 180),
    midheaven: formatAngle("Milieu du Ciel", midheavenLongitude),
    imumCoeli: formatAngle("Fond du Ciel", midheavenLongitude + 180),
    houses,
    metadata: {
      julianDay: Astronomy.MakeTime(date).tt,
      siderealTimeHours:
        (Astronomy.SiderealTime(date) + longitude / 15 + 24) % 24,
    },
  };
}
