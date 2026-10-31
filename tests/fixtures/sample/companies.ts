/**
 * Sample companies for the demo: the fictional firms from the design mockup, with the
 * drivers and evidence the mockup shows. Nothing here is a real company, address, person
 * or number; websites use the reserved .example domain.
 */
import type { ScoreInput } from "../score";
import { companyId } from "../slug";
import type { Company, Driver, Evidence, EvidenceSource } from "../types";

/** The sample run was generated on this date; the welcome rule counts days from it. */
export const SAMPLE_GENERATED_AT = "2026-10-31T09:00:00+01:00";

/**
 * The sample is a slice of a bigger list. A full run of about 200 companies gives this
 * threshold at 60 calls a week, so the sample keeps it instead of recomputing it from 12 rows.
 */
export const SAMPLE_THRESHOLD = 6000;

const FETCHED = "2026-10-25T08:00:00+02:00";
const IMPORTED = "2026-10-20T09:00:00+02:00";
const REGISTER = "2026-10-24T08:00:00+02:00";

function evidence(source: EvidenceSource, finding: string, url?: string, fetchedAt?: string): Evidence {
  const when = fetchedAt ?? (source === "innung" ? IMPORTED : source === "register" ? REGISTER : FETCHED);
  return url ? { source, url, finding, fetchedAt: when } : { source, finding, fetchedAt: when };
}

function driver(value: number, low: number, high: number, confidence: Driver["confidence"], evidence: Evidence[]): Driver {
  return { value, low, high, confidence, evidence };
}

type Seed = Omit<Company, "id" | "address"> & { zip: string; city: string };

function company(seed: Seed): Company {
  const { zip, city, ...rest } = seed;
  return { ...rest, id: companyId(seed.name, zip), address: { zip, city } };
}

export const SAMPLE_INPUTS: ScoreInput[] = [
  {
    company: company({
      name: "Wolff Gebäudetechnik GmbH & Co. KG",
      legalForm: "GmbH & Co. KG",
      zip: "10117",
      city: "Berlin-Mitte",
      website: "https://www.wolff-gebaeudetechnik.example",
      sources: ["innung", "register"],
      registerId: "HRA 50001 B",
      registeredAt: "2009-03-12",
    }),
    technicians: driver(35, 33, 37, "high", [
      evidence("website", "Website lists 41 staff across two locations, about 35 of them technicians", "https://www.wolff-gebaeudetechnik.example/team"),
      evidence("jobs", "4 open roles for technicians", "https://www.wolff-gebaeudetechnik.example/karriere"),
      evidence("website", "Started a heat pump team this year", "https://www.wolff-gebaeudetechnik.example/"),
    ]),
    officeSeats: driver(5, 4, 6, "high", [
      evidence("website", "Office team of five: dispatch, quoting and accounting", "https://www.wolff-gebaeudetechnik.example/team"),
    ]),
  },
  {
    company: company({
      name: "Klimatechnik Nowak GmbH",
      legalForm: "GmbH",
      zip: "12681",
      city: "Berlin-Marzahn",
      website: "https://www.klimatechnik-nowak.example",
      sources: ["innung", "register"],
      registerId: "HRB 150002 B",
      registeredAt: "2015-06-01",
    }),
    technicians: driver(24, 22, 26, "high", [
      evidence("website", "Website says 28 employees", "https://www.klimatechnik-nowak.example/ueber-uns"),
    ]),
    officeSeats: driver(4, 3, 5, "high", [
      evidence("website", "Four office contacts on the team page", "https://www.klimatechnik-nowak.example/team"),
    ]),
  },
  {
    company: company({
      name: "Brandt & Söhne Haustechnik GmbH",
      legalForm: "GmbH",
      zip: "13581",
      city: "Berlin-Spandau",
      website: "https://www.brandt-haustechnik.example",
      sources: ["innung", "register"],
      registerId: "HRB 65003 B",
      registeredAt: "1998-02-19",
    }),
    technicians: driver(18, 16, 20, "high", [
      evidence("website", "Team page lists 18 field technicians and 3 office staff", "https://www.brandt-haustechnik.example/team"),
      evidence("jobs", "2 open roles for HVAC technicians", "https://www.brandt-haustechnik.example/jobs"),
    ]),
    officeSeats: driver(3, 2, 4, "high", [
      evidence("website", "3 office staff on the team page", "https://www.brandt-haustechnik.example/team"),
      evidence("impressum", "New managing director since 2025", "https://www.brandt-haustechnik.example/impressum"),
    ]),
  },
  {
    company: company({
      name: "Krause Wärme & Bad GmbH",
      legalForm: "GmbH",
      zip: "13187",
      city: "Berlin-Pankow",
      website: "https://www.krause-waerme-bad.example",
      sources: ["innung", "register"],
      registerId: "HRB 120004 B",
      registeredAt: "2012-09-03",
    }),
    technicians: driver(11, 9, 13, "medium", [
      evidence("website", "About 11 technicians, going by the team photo and the fleet; 96 Google reviews", "https://www.krause-waerme-bad.example/"),
      evidence("jobs", "1 open job for a technician", "https://www.krause-waerme-bad.example/jobs"),
    ]),
    officeSeats: driver(2, 1, 3, "medium", [
      evidence("website", "Two office contacts on the website", "https://www.krause-waerme-bad.example/kontakt"),
    ]),
  },
  {
    company: company({
      name: "Haustechnik Yıldız GmbH",
      legalForm: "GmbH",
      zip: "12043",
      city: "Berlin-Neukölln",
      sources: ["innung", "register"],
      registerId: "HRB 210005 B",
      registeredAt: "2024-05-21",
    }),
    technicians: driver(8, 6, 10, "low", [
      evidence("register", "Registered GmbH, no website found"),
      evidence("jobs", "Hiring technicians on a job board, team size not stated"),
    ]),
  },
  {
    company: company({
      name: "Meyer Haustechnik GmbH",
      legalForm: "GmbH",
      zip: "10585",
      city: "Berlin-Charlottenburg",
      website: "https://www.meyer-haustechnik.example",
      sources: ["innung", "register"],
      registerId: "HRB 98006 B",
      registeredAt: "2008-11-11",
    }),
    technicians: driver(6, 6, 6, "high", [
      evidence("website", "Team page shows 8 people, 6 of them technicians", "https://www.meyer-haustechnik.example/team"),
    ]),
    officeSeats: driver(2, 2, 2, "high", [
      evidence("website", "Two office staff on the team page", "https://www.meyer-haustechnik.example/team"),
    ]),
  },
  {
    company: company({
      name: "Sanitär Petersen e.K.",
      legalForm: "e.K.",
      zip: "12163",
      city: "Berlin-Steglitz",
      website: "https://www.sanitaer-petersen.example",
      sources: ["innung", "register"],
      registerId: "HRA 40007 B",
      registeredAt: "2016-04-04",
    }),
    technicians: driver(4, 3, 5, "medium", [
      evidence("website", "Small website: the owner and a few technicians; 31 Google reviews", "https://www.sanitaer-petersen.example/"),
    ]),
    officeSeats: driver(1, 1, 1, "medium", [
      evidence("website", "No office staff named", "https://www.sanitaer-petersen.example/"),
    ]),
  },
  {
    company: company({
      name: "Heizung Lindner",
      legalForm: "sole_trader",
      zip: "12555",
      city: "Berlin-Köpenick",
      sources: ["innung"],
    }),
    technicians: driver(2, 1, 3, "medium", [
      evidence("innung", "Guild member, no website; 14 Google reviews"),
    ]),
    officeSeats: driver(1, 1, 1, "medium", [
      evidence("innung", "Sole trader, no office staff listed"),
    ]),
  },
  {
    company: company({
      name: "Bäder & Wärme Schulz e.K.",
      legalForm: "e.K.",
      zip: "13403",
      city: "Berlin-Reinickendorf",
      website: "https://www.baeder-waerme-schulz.example",
      sources: ["innung", "register"],
      registerId: "HRA 30008 B",
      registeredAt: "2011-01-20",
    }),
    technicians: driver(1, 1, 1, "high", [
      evidence("website", "Owner-run, per website", "https://www.baeder-waerme-schulz.example/"),
    ]),
    officeSeats: driver(1, 1, 1, "high", [
      evidence("website", "The owner handles the office", "https://www.baeder-waerme-schulz.example/"),
    ]),
  },
  {
    company: company({
      name: "Kältetechnik Arslan",
      legalForm: "sole_trader",
      zip: "12099",
      city: "Berlin-Tempelhof",
      sources: ["innung"],
    }),
    technicians: driver(1, 1, 2, "low", [
      evidence("innung", "No website, 6 reviews, not in the register"),
    ]),
    officeSeats: driver(1, 1, 1, "low", [
      evidence("innung", "No office staff known"),
    ]),
  },
  {
    company: company({
      name: "Heizungsbau Kraus GmbH",
      legalForm: "GmbH",
      zip: "13189",
      city: "Berlin-Pankow",
      sources: ["register"],
      registerId: "HRB 260009 B",
      registeredAt: "2026-10-25",
    }),
    technicians: driver(2, 1, 3, "low", [
      evidence("register", "Registered on 25 Oct 2026 with two managing directors; likely 2 to 4 people at the start", undefined, "2026-10-31T07:00:00+01:00"),
    ]),
  },
  {
    company: company({
      name: "Wärmetechnik Lorenz & Partner GmbH",
      legalForm: "GmbH",
      zip: "14467",
      city: "Potsdam",
      sources: ["register"],
      registerId: "HRB 38010 P",
      registeredAt: "2026-10-12",
    }),
    technicians: driver(5, 4, 7, "low", [
      evidence("register", "Registered on 12 Oct 2026; founded by a team from a larger firm, likely 5 to 8 people", undefined, "2026-10-31T07:00:00+01:00"),
    ]),
  },
];
