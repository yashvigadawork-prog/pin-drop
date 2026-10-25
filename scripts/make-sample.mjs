// Builds public/sample-test-data.xlsx: a deliberately messy file in the judges' exact
// format (title row, header row, grey example row, data from row 4) that exercises
// every trap the brief warns about. Run: node scripts/make-sample.mjs
import * as XLSX from "xlsx";
import { writeFileSync } from "node:fs";

const appHeader = ["Application ID", "Applicant name", "City", "State", "Pin code", "Investment capacity (₹ lakh)", "Retail experience (years)", "Current / past business", "Space available", "Space size (sq ft)", "Floor", "Target launch (months)", "Preferred language", "Notes from applicant"];
const example = ["APP-001", "Ravi Kumar", "Mysuru", "Karnataka", 570001, 25, 4, "Runs a footwear store", "Rented", 450, "Ground", 3, "Kannada", "Wants to open before Diwali"];

const apps = [
  ["APP-001", "Anitha Rao", "Bengaluru", "Karnataka", 560037, 40, 6, "Runs an optical store in Jayanagar for 6 years", "Owned", 420, "Ground", 3, "Kannada", ""],
  ["APP-002", "Mohammed Irfan", "Bengaluru", "Karnataka", 560037, 35, 3, "Mobile accessories shop", "Rented", 380, "Ground", 4, "Hindi", "Shop is on the main road near the metro"],
  ["APP-003", "Priya Shetty", "Bengaluru", "Karnataka", 560047, 36, 2, "Boutique owner", "Rented", 300, "Mall unit", 5, "English", ""],
  ["APP-004", "Suresh Gowda", "Bengaluru", "Karnataka", 560034, 45, 10, "Ran a supermarket franchise for 10 years", "Owned", 600, "Ground", 3, "Kannada", "Own building in Koramangala"],
  ["APP-005", "Kavya N", "Bengaluru", "Karnataka", 560010, 31, 5, "Runs a gift shop", "Rented", 350, "Ground", 4, "Kannada", "Can add another 4 lakh from my FD if needed"],
  ["APP-006", "Rahul Jain", "Bengaluru", "Karnataka", 560011, 18, 1, "Sales executive", "Not yet identified", "", "Not known", 6, "Hindi", ""],
  ["APP-007", "Deepa Hegde", "Mysuru", "Karnataka", 570001, 30, 5, "Footwear store", "Rented", 450, "Upper", 3, "Kannada", "Shop is on the first floor above a bank"],
  ["APP-008", "Vinay Kumar", "Mysuru", "Karnataka", 570002, 25, 4, "Runs a garments shop", "Owned", 350, "Ground", 2, "Kannada", "Wants to open before Diwali"],
  ["APP-009", "Lakshmi Prasad", "Mysuru", "Karnataka", 570008, 26, 0, "Government school teacher, no business experience", "Not yet identified", "", "Not known", 8, "English", ""],
  ["APP-010", "Arjun Reddy", "Mysuru", "Karnataka", 570009, 30, 7, "Electronics retail", "Rented", 400, "Ground", 4, "Kannada", ""],
  ["APP-011", "Fathima Begum", "Mangaluru", "Karnataka", 575002, 26, 3, "Runs a pharmacy", "Rented", "", "Ground", 4, "English", ""],
  ["APP-012", "Naveen Shetty", "Mangaluru", "Karnataka", 575003, 27, 8, "Electronics showroom manager", "Rented", 500, "Ground", 6, "Kannada", "My son will run the store day to day"],
  ["APP-013", "Sandeep Patil", "Hubballi-Dharwad", "Karnataka", 580029, 25, 5, "Kirana store", "Owned", 280, "Ground", 3, "Kannada", ""],
  ["APP-014", "Meera Kulkarni", "Hubballi-Dharwad", "Karnataka", 580031, 25, 1, "Helps in family clothing shop", "Rented", 200, "Ground", 2, "Kannada", ""],
  ["APP-015", "Ramesh Naik", "Belagavi", "Karnataka", 590006, 30, 6, "Hardware shop", "Owned", 400, "Ground", 3, "Kannada", ""],
  ["APP-016", "Shruti Desai", "Tumakuru", "Karnataka", 572101, 16, 2, "Stationery shop", "Owned", 300, "Ground", 3, "Kannada", ""],
  ["APP-017", "Manjunath B", "Tumakuru", "Karnataka", 572102, 14, 3, "Tailoring shop", "Rented", 320, "Ground", 4, "Kannada", "Will apply for a Mudra loan for the balance"],
  ["APP-018", "Harish M", "Davanagere", "Karnataka", 577001, 20, 4, "Footwear store", "Rented", 380, "Ground", 3, "Kannada", ""],
  ["APP-019", "Pooja Iyer", "Mysuru", "Karnataka", 560066, 28, 3, "Cosmetics counter", "Rented", 350, "Mall unit", 4, "English", ""],
  ["APP-020", "Karthik S", "Bengaluru", "Karnataka", "56003", 35, 4, "Sports goods shop", "Rented", 400, "Ground", 3, "English", ""],
  ["APP-021", "Divya Menon", "Bangalore", "Karnataka", 560102, "₹50 lakh", "12 yrs", "Franchisee of two QSR outlets", "Owned", "800 sq ft", "Ground floor", "asap", "English, Hindi", ""],
  ["APP-022", "Ganesh Rao", "Bengaluru", "Karnataka", 560099, 38, 5, "Runs a bakery", "Rented", 360, "Ground", 4, "Kannada", ""],
  ["APP-023", "Asha K", "Mysuru", "Karnataka", 570020, 25, 3, "Bakery", "Rented", 320, "Not known", 18, "Kannada", ""],
  ["APP-024", "Imran Khan", "Mangaluru", "Karnataka", 575002, "", 6, "Mobile store", "Owned", 400, "Ground", 3, "Hindi", "Funds will come after I sell my plot"],
  ["APP-025", "Sneha Joshi", "Bengaluru", "Karnataka", 560011, 36, 2, "Works at a mall apparel store", "Not yet identified", 400, "Ground", 5, "Kannada", ""],
  ["APP-003", "Priya Shetty", "Bengaluru", "Karnataka", 560047, 36, 2, "Boutique owner", "Rented", 300, "Mall unit", 5, "English", "Submitting again in case first form failed"],
  ["APP-027", "Vikram Singh", "Bengaluru", "Maharashtra", 560102, 37, 0, "Running a watch showroom for 9 years", "Rented", 420, "Ground", 4, "Hindi", ""],
  ["APP-028", "Nithya R", "Hubli", "Karnataka", 580029, 25, 4, "Runs a mobile repair shop", "Rented", 350, "Ground", 3, "", ""],
  ["APP-029", "Rohan Das", "Davanagere", "Karnataka", 577002, 17, 2, "", "Owned", 300, "", "", "", "I am an NRI, will hire a manager"],
];

const terHeader = ["Territory ID", "City", "State", "Pin codes covered", "City tier", "Open slots", "Priority"];
const terExample = ["TER-01", "Mysuru", "Karnataka", "570001, 570002, 570008", "Tier 2", 3, "High"];
const ters = [
  ["TER-01", "Bengaluru", "Karnataka", "560034, 560037, 560047, 560102", "Tier 1", 2, "High"],
  ["TER-02", "Bengaluru", "Karnataka", "560010, 560011, 560076", "Tier 1", 3, "Medium"],
  ["TER-03", "Mysuru", "Karnataka", "570001, 570002, 570008", "Tier 2", 2, "High"],
  ["TER-04", "Mysuru", "Karnataka", "570017, 570020, 570023", "Tier 2", 1, "Low"],
  ["TER-05", "Mangaluru", "Karnataka", "575002, 575003", "Tier 2", 1, "Medium"],
  ["TER-06", "Hubballi-Dharwad", "Karnataka", "580020, 580029, 580031", "Tier 2", 2, "High"],
  ["TER-07", "Tumakuru", "Karnataka", "572101, 572102, 572103", "Tier 2", 2, "High"],
  ["TER-08", "Davanagere", "Karnataka", "577001, 577002", "Tier 3", 0, "Low"],
];

const stores = [
  ["ST-01", "Bengaluru", 560001, 2019], ["ST-02", "Bengaluru", 560034, 2020], ["ST-03", "Bengaluru", 560038, 2021],
  ["ST-04", "Bengaluru", 560066, 2022], ["ST-05", "Bengaluru", 560076, 2023], ["ST-06", "Mysuru", 570009, 2021],
  ["ST-07", "Mysuru", 570017, 2024], ["ST-08", "Mangaluru", 575001, 2022], ["ST-09", "Hubballi-Dharwad", 580020, 2023],
  ["ST-10", "Belagavi", 590001, 2024],
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Applications — one row per record. Row 3 is an example (grey); enter data from row 4."], appHeader, example, ...apps]), "Applications");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Territories — one row per record. Row 3 is an example (grey); enter data from row 4."], terHeader, terExample, ...ters]), "Territories");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["FIXED - all the brand's stores open today. Judges will use exactly this list. Do not edit."], ["Store ID", "City", "Pin code", "Opened (year)"], ...stores]), "Existing stores");
const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
writeFileSync(new URL("../public/sample-test-data.xlsx", import.meta.url), out);
console.log("wrote public/sample-test-data.xlsx with", apps.length, "applications and", ters.length, "territories");
