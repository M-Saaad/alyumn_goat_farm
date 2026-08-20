import type { Animal } from "../lib/types";
import {
  classifyActiveAnimal,
  computePeriodHeadcount,
  isActiveOnDate,
  lastDayOfMonth,
} from "../lib/livestock/period-headcount";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const baseAnimal = (
  overrides: Partial<Animal> & Pick<Animal, "id" | "sex">
): Animal => ({
  name: overrides.name ?? `Goat ${overrides.id}`,
  breed: "Gulabi",
  date_of_purchase: "2026-01-01",
  age_at_purchase: "6 months",
  description: null,
  comment: null,
  status: "Active",
  price: 0,
  sold_price: null,
  purchased_from: null,
  owner_id: null,
  home_bred: false,
  dam_id: null,
  sire_id: null,
  sire_name: null,
  out_date: null,
  palai_rate: null,
  ...overrides,
});

const adultFemale = baseAnimal({ id: 1, sex: "Female", name: "Gulabo", age_at_purchase: "4 teeth" });
const adultMale = baseAnimal({ id: 2, sex: "Male", name: "Brownie", age_at_purchase: "4 teeth" });
const kid = baseAnimal({
  id: 3,
  sex: "Female",
  name: "Kid",
  date_of_purchase: "2026-06-01",
  age_at_purchase: "0",
  home_bred: true,
});
const soldDoe = baseAnimal({
  id: 4,
  sex: "Female",
  name: "Lallo",
  status: "Sold",
  out_date: "2026-07-15",
  age_at_purchase: "4 teeth",
});
const newKid = baseAnimal({
  id: 5,
  sex: "Male",
  name: "Newborn",
  date_of_purchase: "2026-07-20",
  age_at_purchase: "0",
  home_bred: true,
});

const animals = [adultFemale, adultMale, kid, soldDoe, newKid];

assert(isActiveOnDate(adultFemale, "2026-07-31"), "adult active end of July");
assert(!isActiveOnDate(soldDoe, "2026-07-15"), "sold on out date not active that day");
assert(isActiveOnDate(soldDoe, "2026-07-14"), "sold doe active day before out");

const diedNoOut = baseAnimal({
  id: 99,
  sex: "Female",
  name: "Old",
  status: "Died",
  out_date: null,
});
assert(!isActiveOnDate(diedNoOut, "2026-08-20"), "terminal without out date never active");
assert(!isActiveOnDate(newKid, "2026-07-01"), "born mid-month not active at start");
assert(isActiveOnDate(newKid, "2026-07-20"), "born mid-month active from birth date");

assert(classifyActiveAnimal(adultFemale, "2026-07-31") === "breedingFemales", "adult female bucket");
assert(classifyActiveAnimal(kid, "2026-07-31") === "kids", "kid bucket");
assert(classifyActiveAnimal(adultMale, "2026-07-31") === "others", "male in others");

const july = computePeriodHeadcount(animals, "2026-07-01", "2026-07-31");
assert(july.start.breedingFemales === 2, `start females expected 2 got ${july.start.breedingFemales}`);
assert(july.start.kids === 1, `start kids expected 1 got ${july.start.kids}`);
assert(july.start.others === 1, `start others expected 1 got ${july.start.others}`);
assert(july.start.total === 4, `start total expected 4 got ${july.start.total}`);

assert(july.end.breedingFemales === 1, `end females expected 1 got ${july.end.breedingFemales}`);
assert(july.end.kids === 2, `end kids expected 2 got ${july.end.kids}`);
assert(july.end.others === 1, `end others expected 1 got ${july.end.others}`);
assert(july.end.total === 4, `end total expected 4 got ${july.end.total}`);

assert(lastDayOfMonth("2026-07") === "2026-07-31", "July last day");
assert(lastDayOfMonth("2026-02") === "2026-02-28", "Feb last day");

console.log("PASS period headcount");
