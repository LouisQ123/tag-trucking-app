import type { ReactNode } from "react";

interface DeductionItem {
  title: string;
  body: string;
  example?: string;
}

interface Section {
  title: string;
  intro?: string;
  items: DeductionItem[];
}

const SECTIONS: Section[] = [
  {
    title: "Truck & Trailer",
    intro:
      "A dump truck is almost always well over the 6,000 lb GVWR line, and most tandem/tri-axle rigs clear 14,000 lbs too — that generally puts them outside both the passenger-vehicle depreciation caps and the SUV-specific Section 179 cap, so full expensing is usually on the table.",
    items: [
      {
        title: "Section 179 expensing",
        body: "Deduct the full purchase price of a qualifying truck, trailer, or attachment (plow, tarp system, etc.) in the year it's placed in service, up to the annual dollar cap — the cap and phase-out threshold are adjusted for inflation every year, so confirm the current figure before relying on it.",
        example:
          "Buy a $175,000 tri-axle dump truck and place it in service this year. Electing Section 179 lets that full $175,000 offset this year's income at once, instead of the roughly $35,000/year it would take to write off over a standard 5-year schedule.",
      },
      {
        title: "Bonus depreciation",
        body: "An alternative or complement to Section 179 for new and used equipment. The applicable percentage has changed more than once in recent tax law, so check the rate in effect for the year the truck was placed in service.",
        example:
          "On $60,000 of equipment not fully covered by Section 179: at a 100% bonus rate, all $60,000 is deducted this year; at a 60% rate, $36,000 is deducted now and the remaining $24,000 depreciates over the following years.",
      },
      {
        title: "Standard MACRS depreciation",
        body: "For the portion of the cost not expensed under 179 or bonus depreciation, the remainder depreciates over its class life (typically 5 years for over-the-road tractors, longer for other heavy equipment).",
        example:
          "$50,000 of remaining basis on the standard 5-year MACRS table (200% declining balance, half-year convention) follows roughly 20% / 32% / 19.2% / 11.52% / 11.52% / 5.76% — about $10,000 deducted in year one alone.",
      },
      {
        title: "Loan interest",
        body: "Interest on a truck note or equipment loan is deductible as a business expense — only the interest, not the principal.",
        example:
          "A $150,000 truck loan at 8% APR runs roughly $11,500 in interest over the first year. That interest is deductible; the other ~$18,000+ of principal paid down that year is not.",
      },
      {
        title: "Lease payments",
        body: "If a truck or trailer is leased rather than financed, the lease payments are generally deductible as a business expense instead of depreciated.",
      },
      {
        title: "Actual expense method required",
        body: "Heavy trucks don't qualify for the IRS standard mileage rate — deductions are based on actual costs (fuel, repairs, depreciation, insurance, etc.), which makes keeping the detailed records this app already tracks (dates, hours, mileage, fuel) worth its weight.",
        example:
          "A truck running 45,000 miles in a year produces $0 under the standard mileage rate, since it never applies to heavy trucks. Totaling actual fuel, repairs, insurance, and depreciation for that same truck instead often runs well into six figures.",
      },
    ],
  },
  {
    title: "Operating Costs",
    items: [
      {
        title: "Fuel",
        body: "Diesel and DEF for the fleet.",
        example:
          "A truck averaging 6 mpg over 45,000 miles a year burns roughly 7,500 gallons of diesel. At $4.00/gallon, that's about $30,000 in deductible fuel for that one truck.",
      },
      {
        title: "Repairs & maintenance",
        body: "Parts, labor, oil changes, brake work, tire mounting — routine upkeep is fully deductible in the year paid (major overhauls that extend the truck's life may need to be capitalized instead — ask your accountant where the line falls).",
      },
      { title: "Tires", body: "Replacement tires are a deductible operating cost." },
      { title: "Truck washing & detailing", body: "Keeping the rig presentable for job sites and clients." },
      {
        title: "Tolls & parking",
        body: "Toll transponder charges and job-site or terminal parking fees.",
      },
      {
        title: "Commercial insurance",
        body: "Commercial auto liability, physical damage, cargo, and general liability premiums.",
      },
    ],
  },
  {
    title: "Licensing, Permits & Taxes",
    intro: "These are the recurring cost-of-doing-business items specific to interstate/heavy trucking.",
    items: [
      {
        title: "IRP registration",
        body: "International Registration Plan apportioned plate fees, based on miles run in each state.",
      },
      {
        title: "IFTA fuel tax",
        body: "Net fuel tax paid under the International Fuel Tax Agreement is a deductible business tax, separate from the fuel purchase itself.",
      },
      {
        title: "Heavy Vehicle Use Tax (Form 2290)",
        body: "The annual federal excise tax paid for trucks at or above 55,000 lbs gross weight.",
        example:
          "The HVUT for the heaviest weight class tops out around $550 per truck per year — a modest but fully deductible annual cost, and one PennDOT typically wants proof of payment for before renewing the plate.",
      },
      {
        title: "PA vehicle registration & PennDOT fees",
        body: "State registration, title, and inspection fees for the fleet.",
      },
      {
        title: "USDOT / MC number & compliance",
        body: "FMCSA registration fees and related compliance costs (drug & alcohol consortium, ELD subscriptions, etc.).",
      },
      {
        title: "Business licenses & local permits",
        body: "Any municipal or county permits required to operate, plus local business privilege or mercantile tax where a PA municipality imposes one.",
      },
    ],
  },
  {
    title: "Labor",
    items: [
      {
        title: "Driver wages & payroll taxes",
        body: "Gross wages plus the employer share of Social Security, Medicare, and federal/PA/local unemployment tax.",
        example:
          "On a $60,000 driver salary, the employer share of Social Security and Medicare (7.65%) alone runs about $4,590 — plus PA and federal unemployment tax on top. All of it is deductible, not just the base wages.",
      },
      {
        title: "Owner-operator / subcontractor payments",
        body: "Amounts paid to 1099 owner-operators for hauling — keep the 1099-NEC filings current, since these payments are only cleanly deductible with proper documentation.",
        example:
          "Paying an owner-operator $85,000 for the year is fully deductible as a subcontractor expense, but it also triggers a 1099-NEC filing requirement — required once payments to one payee cross $600 for the year.",
      },
      {
        title: "Employee benefits",
        body: "Health insurance contributions, retirement plan matching, and other benefits provided to employees.",
      },
      {
        title: "Workers' compensation insurance",
        body: "Required PA coverage for employees, and a deductible expense.",
      },
    ],
  },
  {
    title: "Business Operations",
    items: [
      {
        title: "Software & technology",
        body: "Dispatch, invoicing, and fleet-tracking software — including this app — GPS/ELD hardware, and related subscriptions.",
      },
      { title: "Phone & communication", body: "Business-use cell phone and radio costs." },
      {
        title: "Office expenses & supplies",
        body: "Paper tickets, printing, postage, and general office supplies.",
      },
      {
        title: "Professional services",
        body: "Accounting, bookkeeping, payroll processing, and legal fees.",
      },
      {
        title: "Bank & processing fees",
        body: "Business bank account fees and credit card processing charges.",
      },
      { title: "Advertising & marketing", body: "Signage, website, and promotional costs." },
      {
        title: "Home office",
        body: "If dispatching, invoicing, or bookkeeping is genuinely done from a dedicated space at home, a portion of home expenses may qualify — this deduction has specific exclusive-use requirements, so it's worth confirming with your accountant before claiming it.",
        example:
          "A 150 sq ft home office in a 1,800 sq ft home is a bit over 8% of the home's space. Under the simplified method (a flat rate per square foot, capped at 300 sq ft), that alone can produce a four-figure deduction without tracking actual utility bills.",
      },
    ],
  },
  {
    title: "Retirement & Health",
    items: [
      {
        title: "SEP-IRA or Solo 401(k)",
        body: "Retirement plan contributions for a self-employed owner or small crew can be substantial and are deductible.",
        example:
          "A SEP-IRA allows contributions up to 25% of net self-employment earnings, subject to an annual IRS dollar cap. On $120,000 of net profit, that's roughly $24,000–$30,000 that can be deposited and deducted the same year, deferring tax until it's withdrawn in retirement.",
      },
      {
        title: "Self-employed health insurance",
        body: "A sole proprietor or partner may be able to deduct health insurance premiums paid for themselves and their family above the line.",
        example:
          "$14,000 a year in family health insurance premiums, fully deductible above the line, reduces taxable income by that same $14,000 — separate from and in addition to itemized or standard deductions.",
      },
    ],
  },
];

const PA_NOTES: DeductionItem[] = [
  {
    title: "PA doesn't always mirror federal depreciation",
    body: "Pennsylvania has historically required an add-back for bonus depreciation at the state level, recovered over later years, rather than matching the federal deduction dollar-for-dollar in the year of purchase. The exact PA treatment has been updated by state legislation more than once — confirm the current rule with your accountant before assuming the federal and PA deductions match.",
    example:
      "Fully expense a $100,000 truck federally in year one, and PA may still only allow a fraction of that same $100,000 against PA income that year — with the rest recovered on future PA returns instead of matching the federal timing.",
  },
  {
    title: "Entity type changes the picture",
    body: "A sole proprietorship or single-member LLC's business income flows to the owner's personal PA return (taxed at PA's flat personal income tax rate), while a C-corporation pays PA Corporate Net Income Tax directly. Which one applies changes which forms these deductions land on.",
    example:
      "PA's personal income tax rate is a flat 3.07% regardless of income level — so on $150,000 of net business profit flowing through to a sole proprietor's PA return, the state-level tax on that profit alone is roughly $4,600, before federal and self-employment tax.",
  },
  {
    title: "Local taxes vary by municipality",
    body: "Some PA municipalities and school districts impose a local Earned Income Tax or a Business Privilege/Mercantile Tax on gross receipts — whether either applies depends on where the business is based and where work is performed.",
  },
];

export default function TaxGuidePage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-8 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Tax Deduction Guide</h1>
        <p className="text-sm text-ink-2 mt-0.5">
          Common deduction categories for a Pennsylvania dump truck business — a reference to bring to your
          accountant, not a substitute for one.
        </p>
      </div>

      <div className="rounded-lg bg-accent-dim border border-accent/30 text-sm text-ink px-4 py-3.5 leading-relaxed">
        <span className="font-bold text-accent">This is general information, not tax advice.</span> Dollar
        limits, phase-outs, and depreciation percentages change with tax law almost every year, and PA doesn&apos;t
        always conform to federal rules on the same schedule. The numbers below are illustrative examples with
        round, made-up figures to show how the math works — not current-year limits. Confirm current figures and
        how they apply to ATG&apos;s specific situation with a CPA or tax preparer — ideally one who already
        works with PA trucking businesses — before filing.
      </div>

      {SECTIONS.map((section) => (
        <Card key={section.title} title={section.title}>
          {section.intro && <p className="text-[12.5px] text-ink-2 mb-3.5 leading-relaxed">{section.intro}</p>}
          <div className="flex flex-col gap-3">
            {section.items.map((item) => (
              <DeductionRow key={item.title} title={item.title} body={item.body} example={item.example} />
            ))}
          </div>
        </Card>
      ))}

      <Card title="Pennsylvania-Specific Notes">
        <div className="flex flex-col gap-3">
          {PA_NOTES.map((item) => (
            <DeductionRow key={item.title} title={item.title} body={item.body} example={item.example} />
          ))}
        </div>
      </Card>

      <Card title="Why It's Worth Tracking Closely">
        <p className="text-[13px] text-ink-2 leading-relaxed">
          Self-employment tax alone is 15.3% on net earnings, on top of PA&apos;s flat 3.07% and whatever federal
          bracket applies. Stacked together, an extra $20,000 in properly documented deductions can mean several
          thousand real dollars not paid in tax — the exact figure depends on the specific numbers, which is
          exactly what a CPA can pin down.
        </p>
      </Card>

      <Card title="Good Documentation Makes These Stick">
        <p className="text-[13px] text-ink-2 leading-relaxed">
          Every deduction above holds up better with records behind it. Production sheets already capture
          dates, hours, mileage, and fuel per truck; invoices and tickets capture the revenue side and any
          attached scans. Keeping that data current in the app all year is most of the legwork your accountant
          needs come tax time.
        </p>
      </Card>
    </main>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
      <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-3.5">{title}</p>
      {children}
    </div>
  );
}

function DeductionRow({ title, body, example }: { title: string; body: string; example?: string }) {
  return (
    <div className="border-l-2 border-accent/40 pl-3.5">
      <p className="text-[13.5px] font-bold text-ink">{title}</p>
      <p className="text-[12.5px] text-ink-2 leading-relaxed mt-0.5">{body}</p>
      {example && (
        <div className="mt-2 rounded-md bg-surface-2 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-accent mb-0.5">Example</p>
          <p className="text-[12px] text-ink-2 leading-relaxed tabular-nums">{example}</p>
        </div>
      )}
    </div>
  );
}
