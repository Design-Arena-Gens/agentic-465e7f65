"use client";

import { FormEvent, useMemo, useState } from "react";
import { ChartComputation, AngleDetail, computeChart } from "@/lib/astro";
import styles from "./page.module.css";

type InputState = {
  date: string;
  time: string;
  timezone: string;
  latitude: string;
  longitude: string;
  altitude: string;
};

const BODY_DESCRIPTIONS: Record<string, string> = {
  Soleil: "Noyau identitaire, volonté, énergie vitale.",
  Lune: "Monde émotionnel, rythmes intérieurs, besoins profonds.",
  Mercure: "Communication, pensée, apprentissage et échanges.",
  "Vénus": "Relation au plaisir, esthétique, manière d'aimer.",
  Mars: "Action, désir, combativité et impulsion.",
  Jupiter: "Expansion, confiance, sens et opportunités.",
  Saturne: "Structure, discipline, responsabilités et limites.",
  Uranus: "Innovation, liberté, intuition et ruptures.",
  Neptune: "Imaginaire, inspiration, idéaux et compassion.",
  Pluton: "Transformations, puissance, régénération profonde.",
};

const HOUSE_FOCUS = [
  "Identité, corps et nouveaux départs.",
  "Ressources, sécurité et valeurs.",
  "Pensée, échanges, curiosité.",
  "Racines, foyer, intimité.",
  "Créativité, amour et expression.",
  "Travail, soins et routines.",
  "Partenariats, alliances et engagements.",
  "Mutations, partages et introspection.",
  "Voyages, sens et horizons.",
  "Carrière, mission et contribution.",
  "Collectif, réseaux et futurs.",
  "Intériorité, rêves et guérison.",
];

function formatOffset(minutesEast: number): string {
  const sign = minutesEast >= 0 ? "+" : "-";
  const absolute = Math.abs(minutesEast);
  const hours = Math.floor(absolute / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (absolute % 60).toString().padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function parseOffset(value: string): number {
  if (!value) {
    throw new Error("Merci d'indiquer un fuseau horaire (ex: +01:00).");
  }
  if (value.toUpperCase() === "Z") {
    return 0;
  }

  const match = value.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) {
    throw new Error("Format de fuseau invalide. Exemple attendu : +01:00");
  }

  const sign = match[1] === "+" ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);

  if (hours > 14 || minutes > 59) {
    throw new Error("Fuseau horaire hors limites validées (±14h).");
  }

  return sign * (hours * 60 + minutes);
}

function buildBirthDate({ date, time, timezone }: InputState): Date {
  if (!date) {
    throw new Error("Merci d'indiquer une date de naissance.");
  }

  const [year, month, day] = date.split("-").map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    throw new Error("Date invalide.");
  }

  const [hours, minutes] = time ? time.split(":").map(Number) : [12, 0];
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error("Heure invalide.");
  }

  const offsetMinutes = parseOffset(timezone);
  const utcMillis =
    Date.UTC(year, month - 1, day, hours, minutes) - offsetMinutes * 60 * 1000;
  const result = new Date(utcMillis);

  if (Number.isNaN(result.getTime())) {
    throw new Error("Impossible d'interpréter la date fournie.");
  }

  return result;
}

function useDefaultFormState(): InputState {
  const now = new Date();
  const minutesEast = -now.getTimezoneOffset();

  return {
    date: now.toISOString().slice(0, 10),
    time: "12:00",
    timezone: formatOffset(minutesEast),
    latitude: "",
    longitude: "",
    altitude: "0",
  };
}

function renderAngle(angle: AngleDetail): string {
  return `${angle.sign.symbol} ${angle.sign.name} ${angle.sign.degreeWithinSign
    .toString()
    .padStart(2, "0")}°${angle.sign.minuteWithinSign
    .toString()
    .padStart(2, "0")}' (${angle.longitude.toFixed(2)}°)`;
}

function renderHouseLabel(index: number, house: AngleDetail): string {
  return `Maison ${index + 1} · ${house.sign.symbol} ${house.sign.name} ${house.sign.degreeWithinSign
    .toString()
    .padStart(2, "0")}°${house.sign.minuteWithinSign
    .toString()
    .padStart(2, "0")}'`;
}

export default function Page() {
  const [inputs, setInputs] = useState<InputState>(useDefaultFormState);
  const [chart, setChart] = useState<ChartComputation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const handleChange = (field: keyof InputState) => (value: string) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const latitude = Number(inputs.latitude.replace(",", "."));
      const longitude = Number(inputs.longitude.replace(",", "."));
      const altitude = Number(inputs.altitude.replace(",", ".") || 0);
      const date = buildBirthDate(inputs);
      const result = computeChart({ date, latitude, longitude, altitude });
      setChart(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Une erreur inattendue est survenue.";
      setChart(null);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, altitude } = position.coords;
        setInputs((prev) => ({
          ...prev,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
          altitude: altitude != null ? altitude.toFixed(0) : prev.altitude,
        }));
        setIsLocating(false);
      },
      () => {
        setError(
          "Impossible d'obtenir votre position. Merci de saisir les coordonnées manuellement.",
        );
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
      },
    );
  };

  const siderealTimeLabel = useMemo(() => {
    if (!chart) return "";
    const hours = Math.floor(chart.metadata.siderealTimeHours);
    const minutes = Math.round(
      (chart.metadata.siderealTimeHours - hours) * 60,
    );
    return `${hours}h${minutes.toString().padStart(2, "0")}`;
  }, [chart]);

  return (
    <div className={styles.page}>
      <main className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.overline}>Thème astral local</p>
            <h1>Calculez votre carte du ciel sans dépendre d&apos;un service externe.</h1>
          </div>
          <p className={styles.lead}>
            L&apos;outil fonctionne entièrement dans votre navigateur : vos données ne quittent
            jamais votre appareil. Saisissez vos informations de naissance, validez, et
            obtenez un thème précis avec planètes, maisons et angles principaux.
          </p>
        </header>

        <section className={styles.grid}>
          <form className={styles.panel} onSubmit={handleSubmit}>
            <h2>Informations de naissance</h2>
            <p className={styles.panelLead}>
              Renseignez tous les champs pour déclencher un calcul sidéral complet.
            </p>

            <div className={styles.fieldset}>
              <label className={styles.label} htmlFor="date">
                Date
              </label>
              <input
                id="date"
                type="date"
                required
                value={inputs.date}
                onChange={(event) => handleChange("date")(event.target.value)}
              />
            </div>

            <div className={styles.inlineGroup}>
              <div className={styles.fieldset}>
                <label className={styles.label} htmlFor="time">
                  Heure
                </label>
                <input
                  id="time"
                  type="time"
                  required
                  value={inputs.time}
                  onChange={(event) => handleChange("time")(event.target.value)}
                />
              </div>
              <div className={styles.fieldset}>
                <label className={styles.label} htmlFor="timezone">
                  Fuseau horaire
                  <span className={styles.hint}>ex: +01:00</span>
                </label>
                <input
                  id="timezone"
                  type="text"
                  inputMode="text"
                  pattern="^([+-]\\d{2}:\\d{2}|Z)$"
                  required
                  value={inputs.timezone}
                  onChange={(event) =>
                    handleChange("timezone")(event.target.value.trim())
                  }
                />
              </div>
            </div>

            <div className={styles.inlineGroup}>
              <div className={styles.fieldset}>
                <label className={styles.label} htmlFor="latitude">
                  Latitude
                  <span className={styles.hint}>-90 à +90 (°)</span>
                </label>
                <input
                  id="latitude"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="48.8566"
                  value={inputs.latitude}
                  onChange={(event) =>
                    handleChange("latitude")(event.target.value)
                  }
                />
              </div>
              <div className={styles.fieldset}>
                <label className={styles.label} htmlFor="longitude">
                  Longitude
                  <span className={styles.hint}>-180 à +180 (°)</span>
                </label>
                <input
                  id="longitude"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="2.3522"
                  value={inputs.longitude}
                  onChange={(event) =>
                    handleChange("longitude")(event.target.value)
                  }
                />
              </div>
            </div>

            <div className={styles.inlineGroup}>
              <div className={styles.fieldset}>
                <label className={styles.label} htmlFor="altitude">
                  Altitude (m)
                </label>
                <input
                  id="altitude"
                  type="text"
                  inputMode="decimal"
                  value={inputs.altitude}
                  onChange={(event) =>
                    handleChange("altitude")(event.target.value)
                  }
                />
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleGeolocation}
                disabled={isLocating}
              >
                {isLocating ? "Localisation..." : "Utiliser ma position"}
              </button>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button className={styles.primaryButton} type="submit" disabled={isLoading}>
                {isLoading ? "Calcul en cours..." : "Calculer le thème astral"}
              </button>
            </div>
          </form>

          <div className={`${styles.panel} ${styles.resultsPanel}`}>
            <h2>Résultats</h2>
            {chart ? (
              <div className={styles.resultsContent}>
                <section className={styles.section}>
                  <h3>Angles majeurs</h3>
                  <div className={styles.cardGroup}>
                    <article className={styles.card}>
                      <h4>{chart.ascendant.label}</h4>
                      <p>
                        {renderAngle(chart.ascendant)}
                      </p>
                    </article>
                    <article className={styles.card}>
                      <h4>{chart.midheaven.label}</h4>
                      <p>
                        {renderAngle(chart.midheaven)}
                      </p>
                    </article>
                    <article className={styles.card}>
                      <h4>{chart.descendant.label}</h4>
                      <p>
                        {renderAngle(chart.descendant)}
                      </p>
                    </article>
                    <article className={styles.card}>
                      <h4>{chart.imumCoeli.label}</h4>
                      <p>
                        {renderAngle(chart.imumCoeli)}
                      </p>
                    </article>
                  </div>
                </section>

                <section className={styles.section}>
                  <h3>Positions planétaires</h3>
                  <div className={styles.planetList}>
                    {chart.planets.map((planet) => (
                      <article key={planet.id} className={styles.planetCard}>
                        <header>
                          <h4>{planet.label}</h4>
                          <span className={styles.planetSign}>
                            {planet.sign.symbol} {planet.sign.name}
                          </span>
                        </header>
                        <p className={styles.planetPosition}>
                          {renderAngle(planet)}
                        </p>
                        <p className={styles.planetDetails}>
                          Maison {planet.house} · Latitude {planet.latitude.toFixed(2)}° ·
                          Déc {planet.declination.toFixed(2)}°
                        </p>
                        <p className={styles.planetDescription}>
                          {BODY_DESCRIPTIONS[planet.label] ?? ""}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className={styles.section}>
                  <h3>Maisons égales</h3>
                  <ul className={styles.houseList}>
                    {chart.houses.map((house, index) => (
                      <li key={house.id} className={styles.houseItem}>
                        <div>
                          <strong>{renderHouseLabel(index, house)}</strong>
                          <p>{HOUSE_FOCUS[index]}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className={styles.section}>
                  <h3>Notes techniques</h3>
                  <ul className={styles.metaList}>
                    <li>
                      Jour julien (TT) :{" "}
                      {(2451545 + chart.metadata.julianDay).toFixed(5)}
                    </li>
                    <li>Temps sidéral local : {siderealTimeLabel}</li>
                    <li>Modèle : éphémérides Astronomy Engine VSOP87</li>
                  </ul>
                </section>
              </div>
            ) : (
              <p className={styles.emptyState}>
                Les résultats apparaîtront ici après validation du formulaire.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
