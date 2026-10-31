/**
 * Pricing formula: monthly = 200 + 100 * (officeSeats - 1) + 25 * technicians, acv = 12 * monthly.
 * The range comes from the low and high driver values. Every function takes an optional
 * pricing so the simulator can try other prices; the default is the config.
 */
import { config } from "../config";
import type { Confidence, Driver, Estimate } from "../types";

export type Pricing = {
  basePerMonth: number;
  perExtraOfficeSeat: number;
  perTechnician: number;
  monthsPerYear: number;
};

export const CURRENT_PRICING: Pricing = {
  basePerMonth: config.pricing.basePerMonth,
  perExtraOfficeSeat: config.pricing.perExtraOfficeSeat,
  perTechnician: config.pricing.perTechnician,
  monthsPerYear: config.pricing.monthsPerYear,
};

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export function lowerConfidence(a: Confidence, b: Confidence): Confidence {
  return RANK[a] <= RANK[b] ? a : b;
}

export function monthlyPrice(technicians: number, officeSeats: number, pricing: Pricing = CURRENT_PRICING): number {
  const seats = Math.max(1, Math.round(officeSeats));
  const techs = Math.max(0, Math.round(technicians));
  return pricing.basePerMonth + pricing.perExtraOfficeSeat * (seats - 1) + pricing.perTechnician * techs;
}

export function yearlyPrice(technicians: number, officeSeats: number, pricing: Pricing = CURRENT_PRICING): number {
  return pricing.monthsPerYear * monthlyPrice(technicians, officeSeats, pricing);
}

/** Office seats when office staff is unknown: 1 + floor(technicians / 7). */
export function officeSeatsFallback(technicians: number): number {
  return 1 + Math.floor(Math.max(0, technicians) / config.pricing.techniciansPerOfficeSeat);
}

/** A derived office-seat driver, with low confidence and no evidence of its own. */
export function officeSeatsFromTechnicians(technicians: Driver): Driver {
  return {
    value: officeSeatsFallback(technicians.value),
    low: officeSeatsFallback(technicians.low),
    high: officeSeatsFallback(technicians.high),
    confidence: "low",
    evidence: [],
  };
}

export function estimateFromDrivers(technicians: Driver, officeSeats?: Driver, pricing: Pricing = CURRENT_PRICING): Estimate {
  const seats = officeSeats ?? officeSeatsFromTechnicians(technicians);
  const monthly = monthlyPrice(technicians.value, seats.value, pricing);
  return {
    technicians,
    officeSeats: seats,
    monthly,
    acv: pricing.monthsPerYear * monthly,
    acvLow: yearlyPrice(technicians.low, seats.low, pricing),
    acvHigh: yearlyPrice(technicians.high, seats.high, pricing),
    confidence: lowerConfidence(technicians.confidence, seats.confidence),
  };
}

/** The formula as text, for the UI. */
export function pricingFormulaText(pricing: Pricing = CURRENT_PRICING): string {
  const { basePerMonth, perExtraOfficeSeat, perTechnician, monthsPerYear } = pricing;
  return `ACV = ${monthsPerYear} × (€${basePerMonth} + €${perExtraOfficeSeat} × (office seats − 1) + €${perTechnician} × field techs)`;
}
