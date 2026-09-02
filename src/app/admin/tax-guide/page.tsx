import type { ReactNode } from "react";

interface DeductionItem {
  title: string;
  body: string;
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
      },
      {
        title: "Bonus depreciation",
        body: "An alternative or complement to Section 179 for new and used equipment. The applicable percentage has changed more than once in recent tax law, so check the rate in effect for the year the truck was placed in service.",
      },
      {
        title: "Standard MACRS depreciation",
        body: "For the portion of the cost not expensed under 179 or bonus depreciation, the remainder depreciates over its class life (typically 5 years for over-the-road tractors, longer for other heavy equipment).",
      },
      {
        title: "Loan interest",
        body: "Interest on a truck note or equipment loan is deductible as a business expense — only the interest, not the principal.",
      },
      {
        title: "Lease payments",
        body: "If a truck or trailer is leased rather than financed, the lease payments are generally deductible as a business expense instead of depreciated.",
      },
      {
        title: "Actual expense method required",
        body: "Heavy trucks don't qualify for the IRS standard mileage rate — deductions are based on actual costs (fuel, repairs, depreciation, insurance, etc.), which makes keeping the detailed records this app already tracks (dates, hours, mileage, fuel) worth its weight.",
      },
    ],
  },
  {
    title: "Operating Costs",
    items: [
      { title: "Fuel", body: "Diesel and DEF for the fleet." },
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
      },
      {
        title: "Owner-operator / subcontractor payments",
        body: "Amounts paid to 1099 owner-operators for hauling — keep the 1099-NEC filings current, since these payments are only cleanly deductible with proper documentation.",
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
      },
    ],
  },
  {
    title: "Retirement & Health",
    items: [
      {
        title: "SEP-IRA or Solo 401(k)",
        body: "Retirement plan contributions for a self-employed owner or small crew can be substantial and are deductible.",
      },
      {
        title: "Self-employed health insurance",
        body: "A sole proprietor or partner may be able to deduct health insurance premiums paid for themselves and their family above the line.",
      },
    ],
  },
];

const PA_NOTES: DeductionItem[] = [
  {
    title: "PA doesn't always mirror federal depreciation",
    body: "Pennsylvania has historically required an add-back for bonus depreciation at the state level, recovered over later years, rather than matching the federal deduction dollar-for-dollar in the year of purchase. The exact PA treatment has been updated by state legislation more than once — confirm the current rule with your accountant before assuming the federal and PA deductions match.",
  },
  {
    title: "Entity type changes the picture",
    body: "A sole proprietorship or single-member LLC's business income flows to the owner's personal PA return (taxed at PA's flat personal income tax rate), while a C-corporation pays PA Corporate Net Income Tax directly. Which one applies changes which forms these deductions land on.",
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
        always conform to federal rules on the same schedule. Confirm current figures and how they apply to
        ATG&apos;s specific situation with a CPA or tax preparer — ideally one who already works with PA
        trucking businesses — before filing.
      </div>

      {SECTIONS.map((section) => (
        <Card key={section.title} title={section.title}>
          {section.intro && <p className="text-[12.5px] text-ink-2 mb-3.5 leading-relaxed">{section.intro}</p>}
          <div className="flex flex-col gap-3">
            {section.items.map((item) => (
              <DeductionRow key={item.title} title={item.title} body={item.body} />
            ))}
          </div>
        </Card>
      ))}

      <Card title="Pennsylvania-Specific Notes">
        <div className="flex flex-col gap-3">
          {PA_NOTES.map((item) => (
            <DeductionRow key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
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

function DeductionRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l-2 border-accent/40 pl-3.5">
      <p className="text-[13.5px] font-bold text-ink">{title}</p>
      <p className="text-[12.5px] text-ink-2 leading-relaxed mt-0.5">{body}</p>
    </div>
  );
}
