# Franchise Screening Engine: Evidence Base

35 evidence cards, each loaded and checked against its source page on 25 Oct 2026. Claims are paraphrased. Confidence: **high** = official company, regulator or government page, SEC filing, or peer-reviewed study; **medium** = reputable press or secondary summary of a primary document; **low** = franchise-listing blog.

Machine-readable version: `evidence.json` (same ids).

## Capital and liquidity

### McDonald's USA (high)
`mcdonalds-nonborrowed-750k`

- **Claim:** To enter McDonald's franchisee training, a candidate must show at least $750,000 net of non-borrowed, unencumbered personal funds, with no partners or investors allowed, plus at least $100,000 for working capital held separately; the candidate must also divest all existing business interests.
- **Figure:** $750,000 non-borrowed + $100,000 working capital
- **Source:** [The journey to becoming a Franchisee (McDonald's U.S. Franchising)](https://www.mcdonalds.com/us/en-us/us-franchising/process.html)
- **Rule it justifies:** Only the applicant's own, non-borrowed funds count toward the liquidity threshold, and a working-capital buffer is required on top of the store fit-out cost.

### Chick-fil-A (high)
`chickfila-nonborrowed-fee`

- **Claim:** Chick-fil-A requires the $10,000 initial franchise fee to come from non-gifted, non-borrowed funds and requires no bankruptcy in the applicant's financial history.
- **Figure:** $10,000 non-gifted, non-borrowed
- **Source:** [Franchise Information and Opportunities | Chick-fil-A](https://www.chick-fil-a.com/franchise)
- **Rule it justifies:** The application asks how much of the stated capital is borrowed or gifted, and the engine scores own funds separately from loan-funded capital.

### US Federal Trade Commission (16 CFR 436.5) (high)
`ftc-item7-additional-funds`

- **Claim:** The FTC Franchise Rule requires Item 7 of the disclosure document to tabulate the estimated initial investment, including an 'additional funds' line covering an initial operating period of at least three months.
- **Figure:** at least 3 months of additional funds
- **Source:** [16 CFR 436.5 - Disclosure items (Cornell LII)](https://www.law.cornell.edu/cfr/text/16/436.5)
- **Rule it justifies:** The required investment for each city tier is capex plus a three-month operating reserve, not capex alone.

### Lenskart (co-founder Amit Chaudhary) (medium)
`lenskart-tier-investment`

- **Claim:** In 2019 Lenskart said its regular franchise for tier-2 markets needed about Rs 35 lakh with expected monthly revenue of Rs 8-10 lakh, while a low-cost 'Lenskart Lite' format for tier-3/4 towns needed about Rs 20 lakh with Rs 4-6 lakh monthly revenue.
- **Figure:** Rs 35 lakh (tier 2) vs Rs 20 lakh (tier 3/4); 25-30% margin; breakeven within ~2 years
- **Source:** [How Lenskart is Tapping Tier 2 & 3 Markets (Entrepreneur India, 7 Nov 2019)](https://india.entrepreneur.com/franchises/how-lenskart-is-tapping-tier-2-3-markets/341974)
- **Rule it justifies:** Minimum investment is calibrated by city tier (Tier 1 highest, Tier 3 lowest) instead of using one national threshold.

### Titan Company (Titan Eyeplus) (high)
`titan-eyeplus-investment`

- **Claim:** Titan's official franchising page says investment in a Titan Eyeplus eyewear franchise begins at Rs 60 lakh, and it expects applicants to have retail experience (especially multi-unit), financial stability and confirmed capital availability.
- **Figure:** from Rs 60 lakh
- **Source:** [Franchising - Titan Company business opportunities](https://titancompany.in/business-opportunities/franchising)
- **Rule it justifies:** Benchmarks our Rs 25-35 lakh eyewear store as a mid-market format, and backs our request for proof that capital is available rather than just declared.

## Financing a shortfall (India)

### Ministry of Finance / PIB (Pradhan Mantri MUDRA Yojana) (high)
`pmmy-mudra-categories`

- **Claim:** MUDRA loans are collateral-free and come in four categories: Shishu up to Rs 50,000, Kishore Rs 50,000-5 lakh, Tarun Rs 5-10 lakh, and Tarun Plus Rs 10-20 lakh (effective 24 Oct 2024). Tarun Plus is only for borrowers who have repaid a Tarun loan, trading activities are eligible, and CGFMU guarantees these loans.
- **Figure:** Shishu <=Rs 0.5L; Kishore <=Rs 5L; Tarun <=Rs 10L; Tarun Plus <=Rs 20L
- **Source:** [Pradhan Mantri Mudra Yojana: Loan Limit Raised to 20 Lakh from 10 Lakh (PIB backgrounder, 29 Oct 2024)](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2024/oct/doc20241029426401.pdf)
- **Rule it justifies:** When an applicant is about 15% short (roughly Rs 4-5 lakh on a Rs 30 lakh store), the engine suggests a Kishore or Tarun loan, and suggests Tarun Plus only if the applicant has already repaid a Tarun loan.

### SIDBI / Stand-Up India (high)
`standup-india`

- **Claim:** Stand-Up India offers composite loans (term loan plus working capital) of Rs 10 lakh to Rs 1 crore to SC/ST and women entrepreneurs for greenfield enterprises, trading included, generally covering up to 85% of project cost, with a minimum 10% own contribution and repayment over 7 years with up to 18 months moratorium.
- **Figure:** Rs 10 lakh-1 crore; min 10% own contribution; 7 years; 18-month moratorium
- **Source:** [Stand-Up India Scheme (standupmitra.in)](https://www.standupmitra.in/Home/SUISchemes)
- **Rule it justifies:** For eligible women or SC/ST applicants opening a new store, the engine points to Stand-Up India as a way to fund the gap, since it needs only 10% own contribution.

### Credit Guarantee Fund Trust for Micro and Small Enterprises (CGTMSE) (medium)
`cgtmse-ceiling`

- **Claim:** CGTMSE, the government-backed trust that guarantees bank credit to micro and small enterprises, says the ceiling of its guarantee coverage has been raised to Rs 10 crore (a Goa government MSME page separately lists trading enterprises as eligible and describes the loans as collateral-free).
- **Figure:** ceiling Rs 10 crore
- **Source:** [CGTMSE home page (secondary: Goa Directorate of Industries, CGTMSE scheme page)](https://www.cgtmse.in/)
- **Rule it justifies:** A collateral-free CGTMSE-backed bank loan is shown as a financing path for applicants who have no property to pledge.

## Owner-operator involvement

### Chick-fil-A (high)
`chickfila-full-time-operator`

- **Claim:** Chick-fil-A requires full-time, hands-on, day-to-day operation by the franchisee, requires divesting all non-passive business interests, and says the role is not for people seeking a passive investment or adding to a business portfolio.
- **Source:** [Franchise Information and Opportunities | Chick-fil-A](https://www.chick-fil-a.com/franchise)
- **Rule it justifies:** The engine flags applicants who say they will run the store part-time or 'through a manager', and notes that point to the reviewer as a risk.

### Apollo Health & Lifestyle (Apollo Clinic) (high)
`apollo-clinic-full-time`

- **Claim:** Apollo Clinic's franchise FAQ says the franchisee should give the clinic full time or a significant amount of time, and answers 'No' to whether a franchisee can be only an investor.
- **Source:** [Apollo Clinic - Franchise FAQs](https://apolloclinic.com/for-franchisee/faqs-franchise)
- **Rule it justifies:** An Indian example that justifies down-scoring pure-investor applicants who will not work in the business.

## Experience

### Domino's Pizza Inc. (high)
`dominos-one-year-store-management`

- **Claim:** Domino's 10-K says it generally requires prospective U.S. franchisees to manage a Domino's store for at least one year and to graduate from its franchise management school before they can franchise.
- **Figure:** 1 year managing a store
- **Source:** [Domino's Pizza Inc. Form 10-K for fiscal 2024 (SEC EDGAR)](https://www.sec.gov/Archives/edgar/data/1286681/000095017025025223/dpz-20241229.htm)
- **Rule it justifies:** Retail or store-management experience is weighted heavily, and applicants with none are sent to an extended in-store training track instead of being rejected.

### Chick-fil-A (high)
`chickfila-experience-leadership`

- **Claim:** Chick-fil-A's minimum requirements include five or more years of professional work experience and having led a team of people.
- **Figure:** 5+ years work experience
- **Source:** [Franchise Information and Opportunities | Chick-fil-A](https://www.chick-fil-a.com/franchise)
- **Rule it justifies:** The experience score credits team-leadership and people-management history, not only retail-specific years.

## Space and site size

### Wellness Forever (pharmacy retail, operating in Karnataka) (high)
`wellness-forever-site-criteria`

- **Claim:** Wellness Forever's official franchise page asks for about 600-1,000 sq ft (750-900 ideal), at least 20 ft of frontage (25-30 ft ideal), corner sites preferred and high-footfall, high-visibility locations, with about Rs 75 lakh total investment; property owners may apply with their own premises, subject to approval.
- **Figure:** 600-1,000 sq ft; min 20 ft frontage; Rs 75 lakh
- **Source:** [Franchise - Wellness Forever](https://wellnessforever.in/franchise.php)
- **Rule it justifies:** Shows Indian franchisors set hard ranges for store size and frontage, which supports our 250-500 sq ft band and a frontage/visibility question; owned premises are accepted subject to a site audit.

### Lenskart (third-party listings only) (low)
`lenskart-space-unofficial`

- **Claim:** No official Lenskart franchise page with size criteria could be found; third-party listings disagree, and this Digit Insurance listing gives Rs 30-35 lakh and 2,000-2,500 sq ft, while blogs that could not be loaded reportedly cite 250-500 sq ft.
- **Figure:** Rs 30-35 lakh; size unverified
- **Source:** [11 Best Retail Franchise in India (Digit Insurance blog)](https://www.godigit.com/business-insurance/franchisee/retail-franchise-in-india)
- **Rule it justifies:** Our 250-500 sq ft and Rs 25-35 lakh calibration is labelled an assumption for a generic brand, not a verified Lenskart rule.

## Floor, frontage and visibility

### Apollo Health & Lifestyle (Apollo Clinic) (high)
`apollo-clinic-ground-floor`

- **Claim:** Apollo Clinic's franchise FAQ specifies about 4,000 sq ft at ground-floor level for a clinic.
- **Figure:** ~4,000 sq ft, ground floor
- **Source:** [Apollo Clinic - Franchise FAQs](https://apolloclinic.com/for-franchisee/faqs-franchise)
- **Rule it justifies:** An Indian franchisor writes the floor into its criteria, which supports treating ground floor as the default and upper floors as an exception that needs review.

### UK Valuation Office Agency (GOV.UK) (high)
`voa-zoning-zone-a`

- **Claim:** The UK government values shops by zoning: Zone A starts at the shop window and is usually 6.1 m deep, each zone further back is worth half the previous one, and upstairs space is valued separately rather than as a zone.
- **Figure:** Zone A depth 6.1 m; each zone back = half value
- **Source:** [Find a business rates valuation - how zoning works (GOV.UK / VOA)](https://tax.service.gov.uk/business-rates-find/valuations/start/13887674000)
- **Rule it justifies:** A government valuation rule that puts the value of retail space in ground-floor frontage, which justifies a lower site score for upper-floor units.

### Academic study (Advances in Science and Technology, Scientific.net) (medium)
`mall-floor-visits-study`

- **Claim:** A study of shoppers' floor choices in a multi-storey mall found that visits fall the higher the floor, with the levels near ground getting the most store visits.
- **Source:** [Movement Behaviour in a Mall Environment: Observing Shoppers' Floor Choices of Strolling](https://www.scientific.net/AST.103.83)
- **Rule it justifies:** Supports the rule that a mall unit on an upper level scores lower than a ground-level mall or high-street unit.

## Signing-to-opening timeline

### New York State Attorney General (Xponential Fitness settlement) (high)
`xponential-ny-ag-timeline`

- **Claim:** New York's Attorney General found that Xponential's disclosure documents estimated three to six months to open, while franchisees actually took more than 13 months on average from signing; the company's own SEC filings reported 10.5-15 months, and it paid $3.97 million.
- **Figure:** disclosed 3-6 months vs actual >13 months; $3,971,250
- **Source:** [Attorney General James Secures More Than $3.9 Million from Xponential Fitness for Misleading Franchise Owners](https://ag.ny.gov/press-release/2026/attorney-general-james-secures-more-39-million-xponential-fitness-misleading)
- **Rule it justifies:** The engine gives realistic signing-to-opening estimates with a buffer, and flags applicants whose target launch window is shorter than the realistic timeline for their site status (for example, no space identified yet).

### Apollo Health & Lifestyle (Apollo Clinic) (high)
`apollo-clinic-launch-timeline`

- **Claim:** Apollo Clinic says a clinic typically takes 8-10 months from signing to launch, and it runs a 10-day training session for staff, followed by periodic refreshers.
- **Figure:** 8-10 months to launch; 10-day staff training
- **Source:** [Apollo Clinic - Franchise FAQs](https://apolloclinic.com/for-franchisee/faqs-franchise)
- **Rule it justifies:** An Indian benchmark for the onboarding plan: a launch timeline in months and a short, structured staff training block before opening.

## Training and language

### McDonald's USA (high)
`mcdonalds-training-languages`

- **Claim:** McDonald's training page lists 12-18 months of in-restaurant training, self-directed and part-time at about 20 hours a week, and says Hamburger University offers management courses in 28 languages.
- **Figure:** 12-18 months; 20 hrs/week; 28 languages
- **Source:** [McDonald's Franchise: Training Program](https://www.mcdonalds.com/us/en-us/about-us/franchising/training-services.html)
- **Rule it justifies:** Training is delivered in the partner's preferred language, and the onboarding plan is structured as phased, part-time training before opening.

### Chick-fil-A (high)
`chickfila-english-fluency`

- **Claim:** Chick-fil-A requires franchise candidates to be fluent in written and spoken English.
- **Source:** [Franchise Information and Opportunities | Chick-fil-A](https://www.chick-fil-a.com/franchise)
- **Rule it justifies:** We take the opposite approach on purpose: training language is a preference that sets which trainer is assigned, not a pass/fail gate, but we cite this to show language is a real screening variable.

### Amazon India (high)
`amazon-kannada-seller-support`

- **Claim:** In January 2021 Amazon launched seller registration, account management, support and Seller University tutorials in Kannada, saying language is a major barrier for Indian MSMEs and targeting 35,000+ existing sellers in Karnataka.
- **Figure:** 35,000+ existing sellers
- **Source:** [Amazon launches seller registrations and account management services in Kannada](https://press.aboutamazon.com/in/2021/1/amazon-launches-seller-registrations-and-account-management-services-in-kannada)
- **Rule it justifies:** Kannada is offered as a training language alongside English and Hindi for Karnataka partners, particularly in Tier 2/3 cities.

### Karnataka Legislative Assembly (medium)
`karnataka-kannada-signboards`

- **Claim:** In February 2024 the Karnataka Assembly passed an amendment requiring Kannada to take up 60% of business name boards, with licence cancellation for non-compliance.
- **Figure:** 60% Kannada on signboards
- **Source:** [Bill mandating 60% Kannada on sign boards passed in Karnataka Assembly (South First)](https://thesouthfirst.com/news/bill-mandating-60-kannada-on-sign-boards-passed-in-karnataka-assembly/)
- **Rule it justifies:** The Karnataka pre-opening checklist includes Kannada-compliant signage; enforcement status after passage was not verified.

## Territory and encroachment

### Domino's Pizza Inc. (high)
`dominos-exclusive-area-fortressing`

- **Claim:** Domino's standard U.S. franchise agreement gives each franchised store an exclusive area of primary responsibility, yet its 10-K warns that 'fortressing' (adding stores in existing markets) may hurt sales at existing stores.
- **Source:** [Domino's Pizza Inc. Form 10-K for fiscal 2024 (SEC EDGAR)](https://www.sec.gov/Archives/edgar/data/1286681/000095017025025223/dpz-20241229.htm)
- **Rule it justifies:** Each approved store gets a defined catchment, and the engine flags new applications that fall inside an existing partner's area.

### US Federal Trade Commission (16 CFR 436.5(l)) (high)
`ftc-item12-territory`

- **Claim:** Item 12 must state whether the franchisee gets an exclusive territory; if not, it must say 'You will not receive an exclusive territory', and it must disclose possible competition from franchisor-owned outlets and other channels.
- **Source:** [16 CFR 436.5 - Disclosure items (Cornell LII)](https://www.law.cornell.edu/cfr/text/16/436.5)
- **Rule it justifies:** The onboarding summary states the territory terms in writing, including whether company-owned stores may open nearby.

### International Franchise Association (51st Legal Symposium paper) (high)
`ifa-encroachment-radius`

- **Claim:** An IFA Legal Symposium paper notes that franchisors most often define exclusive territories as a radius around the store, while boundaries based on streets or postal codes are more precise, and city or county lines should be fixed as of the agreement date.
- **Source:** [Stop Invading My Space: Encroachment Issues in Franchising (IFA Legal Symposium, 2018)](https://www.franchise.org/wp-content/uploads/2026/03/EncroachmentIssuesinFranchising.pdf)
- **Rule it justifies:** The territory is defined by PIN code or locality, which is clearer than a bare radius, especially in dense Bengaluru.

### Azoulay & Shane, Management Science (2001) (high)
`azoulay-shane-exclusive-territories`

- **Claim:** A peer-reviewed study of 170 new franchise contracts found that young franchise chains granting exclusive territories were more likely to survive; press coverage reported that 91% of successful new franchisors granted exclusivity.
- **Figure:** 170 contracts; 91% of successful chains had exclusivity
- **Source:** [Entrepreneurs, Contracts, and the Failure of Young Firms (Management Science 47(3):337-358)](https://ideas.repec.org/a/inm/ormnsc/v47y2001i3p337-358.html)
- **Rule it justifies:** Evidence that territorial protection is good for the franchisor too, not only a concession to partners.

### Lenskart franchisees (reported by The Ken) (medium)
`lenskart-franchisee-encroachment-allegations`

- **Claim:** The Ken reported in April 2025 that Lenskart franchisees allege the company opened its own outlets right next to franchise stores and kept them in the dark about store finances, with complaints filed in Mysuru, Hubballi and Dharwad in Karnataka. These are allegations, and Lenskart obtained a Karnataka High Court stay of the probe.
- **Figure:** franchise share ~30% (2023) to ~12% (2025)
- **Source:** [Lenskart built its empire on franchisees. Now it's battling them in courts (The Ken)](https://the-ken.com/story/lenskart-built-its-empire-on-franchisees-now-its-battling-them-in-courts/)
- **Rule it justifies:** A Karnataka-specific warning: the engine checks company-store plans against partner territories before approval, and shares store financials with partners transparently.

## Due diligence and disclosure

### International Franchise Association (high)
`ifa-diligence-validation-calls`

- **Claim:** The IFA tells prospective franchisees to review the disclosure document with an independent adviser, speak with current and former franchisees, ask each whether they would invest again, and confirm they have the cash and borrowing ability the franchise needs.
- **Source:** [Diligence in Franchising - International Franchise Association](https://www.franchise.org/franchising-overview/diligence-in-franchising/)
- **Rule it justifies:** The onboarding plan includes validation calls with two or three existing partners in a similar city tier before signing.

### US Federal Trade Commission (16 CFR 436.5(t), Franchise Rule) (high)
`ftc-item20-outlets-contacts`

- **Claim:** Item 20 must show three years of franchised and company-owned outlet counts, including openings, closures and terminations, and must list contact details for current franchisees and those who left in the last year; separately, the FDD must be delivered at least 14 days before signing or payment.
- **Figure:** 3 years of outlet data; 14-day disclosure period
- **Source:** [16 CFR 436.5 - Disclosure items (Cornell LII)](https://www.law.cornell.edu/cfr/text/16/436.5)
- **Rule it justifies:** The applicant receives an information pack (store counts, openings and closures, partner contacts) and a cooling-off period before any payment.

### LexOrbis (via Conventus Law) (medium)
`india-no-franchise-disclosure-law`

- **Claim:** India has no franchise-specific law and no legal obligation for franchisors to make pre-sale disclosures; franchising is governed by general statutes such as the Indian Contract Act, Trade Marks Act and Competition Act, and a voluntary disclosure document is recommended best practice.
- **Source:** [Franchise Laws And Regulations India 2025 (Conventus Law / LexOrbis)](https://conventuslaw.com/report/franchise-laws-and-regulations-india-2025/)
- **Rule it justifies:** Our FTC-style disclosure pack is presented as voluntary good practice in India, not a legal requirement.

## Store economics (Lenskart)

### Lenskart Solutions (DRHP, as reported) (medium)
`lenskart-coco-payback`

- **Claim:** Per DRHP coverage, 80.8% of the 703 company-owned stores Lenskart opened in FY2023-FY2024 had paid back by 31 March 2025, with an average payback of 10.3 months; as of 30 June 2025 it had 2,137 India stores, of which 1,831 were company-owned and 306 franchisee-owned.
- **Figure:** 10.3 months avg payback; 80.8% of 703 stores; India 1,831 owned / 306 franchise
- **Source:** [Lenskart IPO news (JK Securities / jkbfsl.com, summarising DRHP)](https://jkbfsl.com/market/ipo/news_details/IPO_News/1646079)
- **Rule it justifies:** Sets an optimistic upper bound for store payback; the engine's projections for franchisees assume slower payback than company-store figures.

### Lenskart Solutions (RHP, via Business Standard) (high)
`lenskart-rhp-franchise-share`

- **Claim:** Per the RHP, Lenskart had 472 franchise stores globally (about 22% of outlets) as of June 2025, franchisees pay a fixed one-time licence fee, and the company flags as a risk that it lacks full operational and financial control over franchisees.
- **Figure:** 472 franchise stores, ~22% of network
- **Source:** [Lenskart IPO opens Oct 31: Know key strengths, risks before you invest (Business Standard, 29 Oct 2025)](https://www.business-standard.com/markets/ipo/lenskart-ipo-opens-october-31-know-key-strengths-risks-before-you-invest-125102900401_1.html)
- **Rule it justifies:** Supports screening hard for partner quality and alignment, because the brand cannot fully control franchise stores once they open.

## Why small retail fails

### US Bureau of Labor Statistics (Business Employment Dynamics) (high)
`bls-retail-survival`

- **Claim:** Of U.S. retail-trade establishments opened in the year to March 2020, 88.0% survived one year and 59.8% survived five years, and only 44.2% of the March 2015 retail cohort survived ten years.
- **Figure:** 1-yr 88.0%; 5-yr 59.8%; 10-yr 44.2% (retail)
- **Source:** [BLS Business Employment Dynamics - Table 7, Survival of private sector establishments by opening year (Retail Trade)](https://www.bls.gov/bdm/us_age_naics_44_table7.txt)
- **Rule it justifies:** The base rate of retail failure is real (about 4 in 10 gone within 5 years), which justifies conservative capital and owner-involvement gates.

### JPMorgan Chase Institute (high)
`jpmc-cash-buffer-days`

- **Claim:** Across about 597,000 small businesses, the median held only 27 days of cash buffer, a quarter held fewer than 13 days, and the retail median was 19 days.
- **Figure:** median 27 days; retail 19 days; 25% <13 days
- **Source:** [Cash is King: Flows, Balances, and Buffer Days (JPMorgan Chase Institute, 2016)](https://www.jpmorganchase.com/institute/all-topics/business-growth-and-entrepreneurship/report-cash-flows-balances-and-buffer-days)
- **Rule it justifies:** Undercapitalisation is the norm, so the engine treats a shortfall in working capital as more serious than a shortfall in fit-out capex.

## Supporting and secondary sources (verified, not carded)

- **McDonald's, older figure:** A 2021 FAQ gave the minimum as $500,000 in non-borrowed personal resources; the current process page says $750,000. [FAQ](https://www.mcdonalds.com/us/en-us/faq/can-you-still-get-a-mcdonald-s-franchise--in-the-united-states--and-how-much-does-it-cost.html)
- **McDonald's process page:** Lists a 6-12 month training programme (the training page says 12-18 months), plus divesting other businesses and relocating. [Process](https://www.mcdonalds.com/us/en-us/us-franchising/process.html)
- **CGTMSE, trading eligibility:** The Goa Directorate of Industries page lists trading enterprises as eligible and the loans as collateral-free. It gives both Rs 5 crore and Rs 10 crore as the ceiling. [Goa MSME CGTMSE](https://msme.goa.gov.in/home/Scheme-Details/Credit-Guarantee-Scheme-for-Micro-&-Small-Enterprises-(CGTMSE))
- **Mudra, Tarun Plus:** All India Radio confirms Tarun Plus (Rs 10-20 lakh) is limited to borrowers who repaid a Tarun loan, with CGFMU cover. [newsonair.gov.in](https://www.newsonair.gov.in/tarun-plus-offers-loan-ranging-from-10-to-20-lakhs-for-entrepreneurs/)
- **FTC on Xponential:** The FTC alleged franchisees were told they would open within six months but typically took more than a year. It secured a $17 million judgment for redress. [FTC, 18 Mar 2026](https://www.ftc.gov/node/329913)
- **FTC Item 15 (owner participation):** The FDD must disclose whether the franchisee must personally take part in running the business, and what conditions apply to an on-site manager. [16 CFR 436.5(o)](https://www.law.cornell.edu/cfr/text/16/436.5)
- **Apollo Clinic, territory and experience:** The FAQ says no two Apollo facilities operate in the same territory, and only one clinic franchise is allocated at first. The "Who can be a franchisee" page asks for prior experience running one's own business. [FAQ](https://apolloclinic.com/for-franchisee/faqs-franchise), [Who can be a franchisee](https://www.apolloclinic.com/for-franchisee/who-can-be-a-franchisee)
- **Titan, experience:** The same Titan page asks for proven industry expertise and retail experience, especially running multiple units. [Titan franchising](https://titancompany.in/business-opportunities/franchising)
- **FTC, "Thinking About Becoming a Franchisee":** Asks whether you will run the business yourself or hire a manager. It warns that it can take years to become profitable and some franchises never do, so you need savings to live on meanwhile. [FTC PDF](https://www.consumer.ftc.gov/sites/default/files/articles/pdf/pdf-0179-buying-a-franchise.pdf)
- **Azoulay & Shane, 91% figure:** Reported in Entrepreneur coverage of the study. [Entrepreneur](https://www.entrepreneur.com/article/39626)
- **Lenskart DRHP basics:** Business Standard confirms the Rs 2,150 crore fresh issue and Rs 272.6 crore for new company-owned stores. [Business Standard, 29 Jul 2025](https://www.business-standard.com/markets/news/lenskart-files-drhp-for-ipo-aims-to-raise-2150-crore-check-key-details-125072900815_1.html)
- **Lenskart payback, second source:** Outlook Business reports a 10.4-month payback against 24-36 months at Titan, Trent and DMart. This is the company's own roadshow framing. [Outlook Business](https://www.outlookbusiness.com/news/how-lenskart-convinced-radhakishan-damani-sbi-mutual-fund-to-invest-at-77-bn-valuation)
- **BLS, all private sectors:** 80.9% of establishments survive 1 year and 51.4% survive 5 years (March 2020 cohort); 34.7% survive 10 years (March 2015 cohort). [BLS Table 7](https://www.bls.gov/bdm/us_age_naics_00_table7.txt)
- **Amul, low-cost formats (2018):** A kiosk of 100-150 sq ft costs about Rs 2 lakh and a scooping parlour of 300 sq ft about Rs 6 lakh, with no royalty. [Business Today](https://businesstoday.in/current/economy-politics/how-amul-grants-franchise-to-retailers-with-no-royalty-revenue-share/story/280584.html)
- **FirstCry enquiry form:** Asks for available capital (Rs 35-50 lakh or Rs 50 lakh+) and space (1,000-3,000 / 3,000-5,000 / 5,000+ sq ft). This shows franchisors bucket applicants into bands. [FirstCry franchise](https://www.firstcry.com/franchise)
- **Franchise scams in India:** In 2020 Reliance Retail warned about fake JioMart franchise websites and said it charges no fee to appoint franchisees. Never ask applicants for upfront money through unofficial channels. [Business Today](https://www.businesstoday.in/amp/latest/corporate/story/beware-reliance-retail-warns-against-franchise-scam-by-bogus-jiomart-websites-271252-2020-08-27)
- **Chick-fil-A selectivity:** About 0.3% of applicants are reported to be selected (secondary press citing The Washington Post; no official figure). Low-medium confidence. [The College Fix](https://www.thecollegefix.com/bulletin-board/chick-fil-a-is-far-more-selective-than-harvard-about-who-it-lets-in/)
- **Lenskart training pipeline:** Virohan and Lenskart's SureStart programme offers optometry degrees with paid internships across 2,000+ Lenskart stores. This is a staff pipeline, not franchisee onboarding. [BioSpectrum](https://biospectrumindia.com/news/68/26120/virohan-and-lenskart-join-hands-to-build-next-generation-of-optometrists.html)

## Gaps (could not verify)

- **Lenskart:** No official franchise page with criteria (investment, sq ft, floor) was found, and the Lenskart site has no /franchise page. The 250-500 sq ft and Rs 25-35 lakh figures appear only in blogs and conflict with each other. There are many unofficial "Lenskart franchise" Google Sites and Adobe pages, which look like possible scams. No FoFo-specific payback figure was found.
- **Indian brands with no official criteria page found:** Apollo Pharmacy (as distinct from Apollo Clinic), MedPlus, Amazon "I Have Space" (Amazon pages list only storage space, staff for deliveries and no fee, with no sq ft figure) and Delhivery.
- **Ground floor vs upper floor in India:** No Indian report (Knight Frank, JLL, Anarock) breaking out rents or footfall by floor was found. Floor evidence is the UK VOA zoning rule, Apollo Clinic's ground-floor requirement, Wellness Forever's frontage and corner rules, and one academic mall study. Nothing usable was found on mall vs high street.
- **Reasons for failure:** No official SBA page ranking "insufficient capital" as a cause was found. The cards use BLS survival data and JPMC cash-buffer data instead. No rigorous study of absentee-owned vs owner-operated franchise performance was found; the owner-operator rules rest on franchisor policies (McDonald's, Chick-fil-A, Apollo Clinic) and FTC Item 15.
- **Domino's India / Jubilant:** India-specific franchise rules were not checked. Domino's evidence is from its US 10-K.
- **Blocked or failed checks:** CNBC's Chick-fil-A article (blocked), the INFORMS press release (Cloudflare check, not bypassed), the 1998 Fortune Subway encroachment article (404), and mudra.org.in (certificate error; the PIB PDF was used instead).
- **Karnataka Kannada signboard bill:** Passed by the Assembly in Feb 2024. Its final enactment and enforcement status were not verified.
