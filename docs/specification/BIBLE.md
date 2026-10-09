# Nationwide Nigerian Life and Political Simulator

## Master specification bible

Version 1.1 | 8 October 2026 | Product owner edition

The game is a persistent Nigerian life and political simulation in which citizens work, study, form households, run businesses, participate in government, socialise and build a legacy. The world should work like a body: changes in one system produce understandable consequences in connected systems, and citizens have practical ways to respond.

This bible defines the product rules and the contracts that connect the simulation. It is the authoritative baseline for implementation, balancing, verification and controlled activation. All specified systems belong to the prelaunch build scope. Public availability may be staggered through the administration dashboard after those systems have been implemented and tested.

Latest build instruction: complete the main game and its connected database/environment setup; do not publish or show further preview iterations. Main publication remains held until all specified systems are implemented and verified.

The initial public service is designed for adults aged 18 and above. Its currency, institutions, laws, elections, financial products and professional qualifications belong to the fictional simulation. Qualification in the game does not confer a real professional credential. Players can pursue an ordinary comfortable life as fully as they can pursue wealth, public office or national influence.

### How to use this bible

Product owners use the decision register to settle remaining choices. Engineers implement the numbered requirements and domain contracts. Designers translate the lifecycle and UX rules into world interactions. Testers verify the acceptance scenarios. Operators use the administration and release rules to open completed systems without breaking existing obligations.

“Required” states a product or implementation obligation. “Proposed default” is a concrete design choice supplied for this baseline and remains changeable through the decision register. “Balance seed” is an initial simulation parameter, not a validated launch value. “Release gate” is a measurable condition that must pass before public activation. A specified feature is not evidence that its code already exists.

## Contents

1. Game design and world rules
2. Player life and progression
3. World dependencies and simulation contracts
4. Economy and resource flows
5. Government law and civic power
6. Technical architecture
7. Database commands and event architecture
8. Administration support and operations
9. User experience and visual system
10. Release catalogue and completion gates
11. Requirements and coverage register
12. Decisions acceptance scenarios and project memory
13. Technical reference notes

# 1 Game design and world rules

## 1.1 Product promise

Citizens should experience a country rather than a collection of isolated menus. A student takes transport to school, pays tuition from wages, earns a qualification, applies for a job and changes the household budget. A business purchases inventory, books a shipment, employs staff, pays taxes and gains verified reviews. A government repairs roads using a finite treasury; delivery becomes more reliable and citizens can see the effect in prices, business activity and approval.

The game teaches through consequences and recoverable decisions. Overspending reduces savings; neglected vehicles need repair; education improves eligibility; poorly managed companies lose customers; damaged infrastructure raises costs. Every punishment, failure and setback must leave a credible route back into useful play.

## 1.2 Non negotiable principles

- All agreed systems are built, integrated and tested before the launch readiness gate. A hidden menu, placeholder endpoint or empty database table is not a completed feature.
- Public activation is a separate decision. Operators release completed systems through versioned flags, schedules and announcements.
- The server decides ownership, money, eligibility, inventory, elections, professional authority and legal outcomes. Clients submit intentions.
- Essential survival and progression remain available through NPC services when players are absent, institutions fail or a feature is closed to new entrants.
- Players receive clear reasons for material changes: prices, licence restrictions, job rejection, arrest, debt, reputation and eligibility.
- Real money cannot buy votes, office, superior qualifications, guaranteed returns or control over other citizens.
- Powerful roles have bounded permissions, transparent actions, review mechanisms and succession rules.
- Leisure and an ordinary life are valid end states. Becoming powerful is optional.
- Scarcity, risk and social inequality create stories without permanently excluding a citizen from meaningful play.
- Reliability on low end phones and unreliable mobile connections is a core design condition.

## 1.3 World geography and identity

The geographic catalogue covers Nigeria's 36 states and the Federal Capital Territory, with named cities, local government areas, neighbourhoods, routes, buildings and service locations. Exact map coverage, city lists and district art budgets are settled in D01. The current main map is an authored 66×42 neighbourhood with three connected districts; it preserves the original service entrances. The finite regional home and constructed-land catalogues now have distinct representative street entrances; other residential facades remain scenery. This does not establish national city/LGA or property-lot coverage. Map geography is representative rather than a promise of street accurate recreation. No state is permanently unavailable for citizenship or interstate travel because its detailed art is incomplete.

Regions support distinct strengths in agriculture, manufacturing, ports, tourism, technology, government services, energy and mining. These are configurable specialisations, not claims that every real state has one fixed industry. Multiple sectors can operate in each region. Differences in resources, infrastructure, taxes, skills and demand give interstate trade a purpose.

Proposed default: one political nation per world, with multiple city and interior instances sharing the same persistent economy and government. Every durable record has a world identity. A future second world receives separate accounts, elections, offices and treasuries; possessions and political rights never duplicate across worlds through a travel exploit.

## 1.4 Citizen activities and session rhythm

A short visit should allow a citizen to review needs and recent notifications, complete a small shift or lesson, send a message and choose the next goal. Longer sessions support travel, business operation, emergency response, roleplay, events and civic work. Progress should not demand continuous attendance or sleep disruption.

The national calendar contains elections, admissions, sports seasons, festivals, awards, business periods and budget cycles. Event schedules show real dates and the citizen's local timezone. The world simulation uses a published clock policy; deadlines for payments, shifts, elections and events use server time rather than the device clock.

## 1.5 Safety net and fair adversity

No new citizen can be immediately trapped by hunger, homelessness, predatory contracts or unrestricted crime. Essential food, starter shelter, baseline work, foundation education and basic healthcare remain accessible. Protective assistance is distinct from ordinary market income and has explicit eligibility, limits and a taper.

Poverty affects choices, housing quality, transport dependence and education funding. Scholarships, apprenticeships, assistance, starter jobs and rehabilitation preserve mobility. Wealth brings property maintenance, taxes, payroll, insurance and security expenses. Neither path is a permanent victory or defeat state.

Proposed default: no permanent character death in routine play. Incapacitation creates treatment and recovery gameplay with capped losses. Permanent deletion, inheritance and retirement policies require a separate explicit design decision under D08.

## 1.6 Shared systems catalogue

The full scope includes citizenship; households; education; skills; qualifications; employment; business ownership; supply chains; finance; taxation; property; utilities; transport; healthcare; public safety; courts; prisons; military; politics; media; social communication; relationships; organisations; crime; insurance; emergencies; sports; music; events; philanthropy; legacy; NPC operation; administration; platform commerce; accessibility; network recovery and auditability.

Every domain must declare an owner, inputs, outputs, permission checks, event contracts, fallback, maximum player harm, recovery path, telemetry and acceptance criteria. Part 3 supplies the connection rules; Part 11 is the coverage index.

# 2 Player life and progression

## 2.1 Account and character creation

The entry flow is age and account eligibility, account creation, world selection, citizen name and appearance, state choice, starting path, initial housing and an in world welcome. One eligible account has one active voting citizen in a world. Additional character policy is unresolved under D02; it cannot create additional ballots or duplicate starter benefits.

Names and appearance pass published content rules. Citizens receive a stable identity, bank account, starter phone or SIM access, navigation assistance and a clear record of starting benefits. The welcome NPC directs the first actions; the citizen performs them in the world rather than dismissing a giant manual.

The current main-build appearance component offers curated free skin tones, adult frames, hairstyles, hair colours and clothing styles/colours at creation. Saved changes require a nearby placed wardrobe in the current home, a valid location lease/layout version and an open wall edge. Profile versions and immutable receipts protect reload/retry; appearance grants no economic, voting or professional benefit. These original procedural models remain subject to production-art, cultural and device acceptance under D24. Read docs/appearance-contract.md for the implemented component and remaining customization scope.

The starting bundle is provisioned atomically. Retrying account setup cannot issue another allowance, residence, phone or household assignment. State selection explains services and regional identity without promising an economic advantage that has not been balanced.

## 2.2 Starting paths and households

Independent Start gives baseline cash, temporary accommodation, essential food access and full personal control. Random Family Start assigns an NPC household from struggling, working class, middle class, upper middle class and wealthy bands. Household Invitation is implemented before launch and may be publicly activated later; it permits an eligible adult to join a consenting established player household.

NPC households contain named adults, personalities, occupations, income, assets, expenses, relationships and expectations. Benefits can include accommodation, meals, allowance, transport, partial tuition and introductions. Obligations can include a bounded contribution after employment, help with a family business or voluntary support during illness. A wealthy start cannot bypass exams, licences, residence requirements or office eligibility.

Assignment uses a server seed and a published distribution. Proposed balance seed: struggling 20%, working class 35%, middle class 30%, upper middle class 12%, wealthy 3%. These values require simulation testing. Starting family wealth is not sold, and real money cannot purchase a reroll. D03 fixes the free reset policy before release.

NPC families can lose employment, gain income, encounter illness, pay for education and experience business success or failure. Events respect cooldowns and maximum loss limits. Household events cannot secretly debit a member's personal account or force payment of another member's debt. A citizen may decline, negotiate or leave with baseline shelter assistance.

Player households use invitations, acceptance, membership roles and explicit permissions. Shared balances and assets are separate from personal property. Marriage, partnership and household joining require mutual consent; separation, blocking and leaving remain available. Joining does not transfer the citizen's assets. No member can compel another to marry, work, hand over passwords or surrender personal funds.

## 2.3 Citizen Foundation Programme

The free NPC operated foundation programme runs across the first five real days while allowing immediate starter work. Proposed timing rule: each module becomes available after a rolling 24 hour interval from enrolment; progress pauses while the citizen is absent and modules remain available after their unlock. This prevents calendar midnight shortcuts while avoiding punishment for missed attendance. D04 confirms this policy and accessibility accommodations.

| Day | Curriculum | Practical activity |
| --- | --- | --- |
| 1 | Movement needs food health housing transport banking and work | Find shelter buy a basic meal complete a starter shift |
| 2 | Chat messages relationships reputation organisations and safety | Set privacy controls practise blocking and reporting |
| 3 | Wages budgets taxes debt contracts business and scam awareness | Inspect a payslip compare costs read a sample contract |
| 4 | Rights police powers crime courts government and voting | Respond to a lawful notice inspect a sample evidence file |
| 5 | Education licences careers public service politics and legacy | Compare tracks choose a goal take the citizen exam |

Lessons are short world tasks supported by text, optional audio and NPC demonstrations. No required answer is contained only in audio. Each lesson references the versioned game rules. Examination questions cannot be changed retroactively to invalidate an earned certificate.

Proposed exam seed: 20 randomised questions, 80% pass mark, untimed by default, unlimited free retries with a short review lesson after failure. The question bank must assess understanding rather than obscure facts. A failed exam retains starter work, housing and healthcare access. Passing grants the Foundation Citizen Certificate and unlocks the next education and career eligibility layer.

## 2.4 Starter jobs and paid work

Starter work includes cleaner, shop assistant, delivery helper, market assistant, construction labourer, car wash worker, farm helper, warehouse hand, bus assistant and basic courier. Each has an NPC fallback, short repeatable tasks, a visible pay offer, skill gains and fatigue cost. Basic work is available from the first day without professional credentials.

NPC employers supply reliable entry work; player employers post real vacancies. Repeated low skill tasks can support a modest life, while qualifications and experience open higher wages and responsibility. A citizen never has to purchase a real money item to obtain work.

## 2.5 Education ladder and professional eligibility

The progression sequence is foundation certificate, secondary or vocational track, discipline training, professional examination, supervised practice where required, full licence and continuing specialisation. Experience, reputation and lawful background checks can supplement education but cannot fabricate a qualification.

| Track | Required path | Resulting opportunities |
| --- | --- | --- |
| Medicine | Health foundation nursing or medical programme professional exam supervised practice | Clinical roles specialisation hospital leadership |
| Police | Foundation academy exam background review interview probation | Bounded police duties ranked progression |
| Military | Foundation academy branch choice fitness or skills assessment specialist training | Emergency security and logistics assignments |
| Business | Foundation business fundamentals sector licence where needed | Company formation management finance training |
| Politics | Foundation civic leadership local state and federal eligibility programmes | Candidate and office eligibility at the appropriate level |
| Technical trades | Vocational study apprenticeship practical exam | Mechanics electrical work construction and logistics |
| Creative and media | Foundation portfolio or practice media and event training | Journalism entertainment artist and production work |

Official curricula, qualification rules and exams are system controlled. Player tutors, mentors, private schools, universities and training businesses operate against approved curricula. They can charge virtual tuition, employ staff and issue recorded course completion; authoritative certificates require the system's eligibility and examination checks.

Foundation education is free. Advanced education costs virtual money and can be funded through wages, grants, scholarships, family support or regulated education loans. Earlier illustrative fees such as NGN 15,000 for vocational study, NGN 75,000 for business and NGN 100,000 or more for nursing are examples only; Part 4 ties actual fees to earning time.

Learning remains asynchronous where possible. An unavailable instructor, closed school or departing tutor cannot prevent progress: approved NPC services or a transfer provide completion, with tuition disputes handled through contracts and support.

## 2.6 Hiring interviews and contracts

A vacancy records company, role, location, work schedule, pay period, wage, credentials, interview requirements and application deadline. Application moves through submitted, reviewed, interview offered, decision, offer accepted and active employment. Employers can reject with a recorded reason, but cannot obtain access to passwords, private messages or unrelated records.

Government roles can require examination and interview. Police, judiciary, military and sensitive public offices use a scoped background review. A conviction may block selected roles temporarily; sentence completion, appeal and rehabilitation can restore eligibility under a published schedule. Arrest alone is not an automatic permanent employment ban.

Employment contracts state duties, pay, notice, work limits, probation, dispute process and termination terms. Wages for committed work are prefunded or otherwise secured under the payroll rules. A player leaving a company does not delete earned wages. Abuse reports are handled separately from ordinary game performance disputes.

## 2.7 Skills reputation and life directions

Skills grow through verified tasks, study and supervised practice. Relevant examples are driving, logistics, repair, medicine, farming, accounting, leadership, investigation, journalism and performance. Minigames should have accessible alternative interaction modes with equivalent rewards.

Reputation has scoped dimensions: reliability, professional quality, civic standing and social trust. A mechanic's poor repair record does not automatically make the citizen medically unqualified. Only verified completed transactions can create customer reviews. One eligible review per completed service, dispute windows, edits and suspicious pattern review limit manipulation.

Supported directions are career, entrepreneurship, public service, politics, creative and social life, street or crime activity, and ordinary citizenship. Citizens may change direction. Crime is a fictional path with evidence, consequences and rehabilitation; it cannot justify harassment, forced social interactions or unlimited predation.

## 2.8 Needs housing relationships and offline life

Needs include hunger, energy and health. Housing supplies safety, rest and storage; higher quality housing adds convenience and social status. Utilities, rent and maintenance connect homes to the economy. Needs change with active tasks and recover through food, rest and treatment.

Proposed offline rule: survival needs stop deteriorating after the bounded offline window. Inactivity cannot cause death, repeated robbery or catastrophic medical bills. Scheduled contracts and business obligations continue through disclosed NPC delegation, grace periods and caps. Citizens see an offline summary before taking new commitments.

Relationships include friends, partners, households, mentors, colleagues and organisations. Privacy, consent, block and leave controls override social benefits. An event invitation or family connection can create an interview opportunity, never a guaranteed licensed job or private information entitlement.

Friendship and partnership requests use an opt-in inbox, exact recipient consent and separate private records. Either participant may leave, and either block ends pending and active ties. An accepted social connection shares no money, home access, wardrobe, household or messaging permission. Disabling requests closes incoming pending requests; invitation expiry refreshes connected private controls even without a business event. See docs/relationships-contract.md for the local component and proposed D31 safeguards; dates/events, marriage, NPC relationships and shared household residence remain in scope.

Home visits require a resident invitation and the recipient's explicit acceptance of the particular home, expiry and permissions. Guests can walk and use allowed placed furnishings; entry does not transfer furniture, wardrobe, parking, tenancy, property or household authority. Leaving and withdrawal remain available. Expiry, blocking and lost resident permission end private access and safely return the guest to the street. Opted-in active peers share only their authorised home instance. See docs/home-visits-contract.md for the local component and proposed D29 bounds; broader relationship and cohabitation systems remain in scope.

## 2.9 Life events and legacy

Life events include rent changes, scholarship offers, promotion, vehicle service, family requests, wedding invitations, business orders and interviews. Events derive from actual state, use frequency caps and explain choices and costs. They do not present false payment emergencies that pressure the player to buy premium currency.

Established citizens can endow scholarships, build universities, fund charities, mentor newcomers, sponsor football clubs, own media organisations, commission landmarks, become party elders and preserve a record of service. Political dynasties describe family history and voluntary networks; office and votes are never inherited.

Legacy records verifiable contributions and major outcomes. Historical recognition does not grant permanent immunity, authority or election privileges. Retirement and inactive leadership transfer operational duties while preserving attributable history.

# 3 World dependencies and simulation contracts

## 3.1 Contract for every subsystem

Every subsystem must identify required resources, outputs, consumers, update cadence, authority, published events, failure signals and recovery actions. Event handlers must be safe to retry. Dependency links have measurable effects, caps and delays; a random narrative message is not a completed economic connection.

Essential services receive NPC fallback capacity. Optional premium supply can genuinely sell out. NPC fallback is bounded and visible: it supports minimum service rather than infinitely undercutting every player enterprise. The economy records all fallback production and expenditure.

## 3.2 Dependency register

| System | Requires | Produces or changes | Failure response |
| --- | --- | --- | --- |
| Fuel and energy | Production imports logistics policy utilities | Fuel stock electricity transport and operating costs | Reserves alternate supply capped essential support |
| Roads and transit | Budgets materials labour maintenance | Route capacity travel time shipment reliability | Detours repair contracts transit subsidy |
| Agriculture | Land water seeds labour energy weather | Food and raw materials farm jobs | Seed support storage imports basic food supply |
| Manufacturing and mining | Inputs power equipment workers safety | Finished goods materials wages | Alternative inputs repairs safety intervention |
| Ports and trade | Terminals carriers storage customs | Regional inventory and commerce | Rerouting clearance support backup carriers |
| Warehousing and logistics | Stock capacity trucks drivers routes | Delivery custody and inventory availability | Insurance replacement dispatch reassignment |
| Education | Buildings staff curriculum funding transport | Skills certificates job eligibility | NPC instruction grants transfers apprenticeships |
| Employment | Demand capital qualifications contracts | Wages output experience tax revenue | NPC work retraining wage claims |
| Banking and credit | Ledger reserves risk rules contracts | Payments savings loans financing | Limits restructuring virtual resolution |
| Housing and property | Land building materials utilities income | Shelter rent collateral tax base | Starter shelter grace repairs tenancy review |
| Healthcare | Staff medicine facilities power transport | Treatment restored capacity health data | NPC care referral emergency subsidy |
| Security and justice | Evidence trained staff courts budgets | Safety adjudication restitution incarceration | NPC duty cover appeals independent review |
| Government | Mandate budgets verified indicators | Policy public services infrastructure | Acting officials bounded automation elections |
| Insurance | Premiums reserves evidence investigators | Claims payments recovery risk pricing | Reserve controls disputes virtual resolution |
| Entertainment and sport | Venues staff power media approved music | Tickets leisure jobs sponsorship | Reschedules refunds NPC event support |
| Media and social | Content services verification moderation | Discovery reports polls civic attention | Reporting appeals limited safe communication |
| Households and charity | Contributions consent transparent accounts | Support education relief social mobility | Exit options audits baseline services |
| Weather and disasters | Scheduled simulation exposure safeguards | Damage closures emergency demand | Multi service response relief rebuilding |
| Legacy | Verified contributions history institutions | Recognition mentorship durable projects | Stewardship and continuity appointments |

## 3.3 Fuel road and price propagation

Fuel cost affects transport and production through explicit consumption. Road condition affects speed, damage risk and delivery probability. Delivery cost contributes to supplier landed cost, which influences advertised prices. Citizens and businesses respond by changing routes, modes, quantities or suppliers. Employment and government approval respond to observed outcomes after a delay.

Proposed formula: shipment cost equals driver cost plus distance multiplied by fuel consumption and fuel price, plus road wear, tolls, insurance and carrier margin. Travel time equals route distance divided by condition adjusted speed, plus queues and incidents. Risk uses bounded probability bands; a damaged road does not guarantee theft or destruction.

Price changes cannot propagate instantly through every price in the nation. Existing inventory preserves its acquisition cost; new deliveries affect the next stock batch. UI price explanations identify major contributors. Subsidies, strategic reserves, repairs and alternate transit counter the shock using finite budgets.

## 3.4 Education and labour propagation

Education consumes tuition, transport and time, pays staff and suppliers, and produces eligibility. Employers create demand for qualified workers from actual funded positions. Too many graduates for available jobs must be detectable through vacancy, applicant and employment metrics. Grants and curriculum changes respond to shortages rather than automatically guaranteeing every graduate a high salary.

Schools employ teachers, administrators, cleaners, vendors, security and transport providers. Students support housing, meals, devices and travel. Education loans create repayments tied to disclosed schedules. Business, government and wealthy citizens fund scholarships through escrowed awards rather than an unfunded promise.

## 3.5 Crime public confidence and response

Economic stress, opportunity, security coverage and local activity can influence the simulation's crime pressure. These are game parameters, not assertions that poverty makes a real person criminal. Player initiated crime requires a defined target, rules, risk, evidence and loss cap.

Crime can create injuries, property damage, insurance claims, police cases, court work and media stories. Local business confidence and property demand may change within bounded ranges. Arrests without adjudication cannot be treated as convictions. Better employment, safety, treatment and rehabilitation can reduce pressure over time.

## 3.6 Disaster and emergency contract

Floods, storms, major accidents, disease events and infrastructure collapse have severity, footprint, duration, affected services and response objectives. A declared emergency opens bounded assignments for hospitals, police, firefighters, disaster agencies and military support. It does not automatically suspend all player rights or grant arbitrary confiscation powers.

Emergency spending identifies budget or reserve accounts. Relief grants use verified exposure and cannot be claimed repeatedly by reconnecting. Evacuation preserves essential belongings under published limits. Schools, businesses and events receive service interruption and refund rules. Recovery creates repair, logistics and rebuilding jobs.

## 3.7 Feedback control and runaway prevention

Simulation changes use rate limits, thresholds and recovery levers. Food scarcity, debt, injuries, unemployment and infrastructure damage cannot feed an unbounded collapse loop. Essential prices and survival access have explicit protection limits; premium inventory remains market driven.

Proposed economy cadence: local supply and orders update continuously by events, region summaries aggregate hourly, and macro indicators update daily. D05 fixes the final cadence. Stability tests include fuel shocks, city service failure, mass inactivity and heavy NPC fallback. An emergency operator intervention remains audited and distinguishable from ordinary policy.

## 3.8 Inactivity and institutional continuity

Companies appoint acting managers and delegate approved duties; payroll, inventory and supplier obligations survive an owner's absence. Government offices use notice, temporary delegation, an inactivity threshold and a lawful replacement procedure. Courts, healthcare, police and schools have NPC cover. A bank or insurance company cannot disappear by deleting its owner's character.

Proposed seed: reminders at 72 hours of unexplained absence, acting authority at seven days, formal replacement review at fourteen days. These thresholds do not apply to approved leave and require D06 confirmation. They control gameplay authority, not access to the user's account. NPCs cannot vote as substitute citizens.

## 3.9 Connection completeness gate

A system is integrated only when a real command changes a durable record, emits its declared event and produces the intended downstream effect. For example, repairing a road must change route calculations and logistics quotes; completing an exam must change eligibility; paying a claim must reconcile insurer and citizen balances. Part 12 includes tests for these connections.

# 4 Economy and resource flows

## 4.1 Currency and accounting

The economy uses fictional naira, displayed as NGN or the naira symbol where supported. There is no implied redemption into real cash. Virtual money, premium entitlements and real platform payments occupy separate ledgers. D07 settles the final currency names and commerce policy before any store activation.

Every virtual money movement uses a balanced journal with integer minor units. A transfer credits and debits equal amounts. Issuance and destruction use named source or sink accounts so the books still balance. Tax, fees and salary are separate journal legs within the same atomic transaction. A material asset changes ownership through a recorded transfer or custody event.

Spendable balance excludes escrow, payroll reserves, pending settlements and frozen disputed sums. Ordinary accounts cannot become negative through a race condition. Credit uses a separate contract and liability balance. Corrections create reversing entries rather than overwriting history. No client, moderator or governor can edit a balance directly.

## 4.2 Sources sinks and circulation

| Flow | Origin or destination | Control |
| --- | --- | --- |
| Starter benefits | Named onboarding issuance account | Once per eligible citizen with abuse checks |
| NPC wages and purchases | Budgeted NPC employer or demand account | Daily issuance budget and task verification |
| Player wages and purchases | Employer or customer account | Existing funds escrow and atomic settlement |
| Public assistance | State federal or programme treasury | Eligibility capped awards budget approval |
| Scholarships and charity | Donor escrow or charity account | Restricted purpose recipient verification |
| Tuition and licensing | School provider and designated fees | Refund terms completion and cost targets |
| Food fuel utilities repairs | Supplier or system provision account | Stock consumption and recorded production |
| Taxes and levies | Public treasury accounts | Published rate authority scope and caps |
| Rent insurance and debt | Landlord insurer or lender accounts | Contracts reserves dispute handling |
| Asset sales and acquisitions | Buyer seller and required fees | Ownership checks valuation disclosures |
| Luxury maintenance and system fees | Provider or declared destruction account | Visible schedule and burden limits |

Paying a player supplier circulates money; paying a tax moves money to a treasury; neither destroys money merely because it is an expense. The dashboard distinguishes circulating supply, issuance, actual destruction, credit liabilities and locked reserves.

## 4.3 Balance methodology

Set costs in units of earning time before fixing nominal naira amounts. A starter shift must pay enough toward a modest daily basket of food, basic transport and shelter without forcing constant play. Higher qualifications increase earning potential but also create study costs, job scarcity and responsibility.

Proposed targets: a returning citizen can maintain basic survival through about 15 to 25 minutes of ordinary active work a day; starter protection covers the first five days; a first vocational certificate requires approximately three to five starter work days of saving. These are balance seeds, not promises of a tested economy.

Testing measures time to first safe home, first exam pass, first qualification, first skilled job, first business and recovery after insolvency. Analyse outcomes by start wealth, state, disability accommodation, session length and device quality. The poorest supported start must retain a realistic path to skilled work without premium purchases.

## 4.4 Goods production inventory and scarcity

Goods have catalogue identity, unit, quality, shelf life where applicable, batch, owner, quantity, location and cost basis. Production consumes actual recipe inputs and capacity. Inventories distinguish available, reserved, in transit, damaged and consumed stock. Reserving the final item is atomic; concurrent buyers cannot both purchase it.

NPCs guarantee a basic essential catalogue under bounded fallback policy. Premium and specialised goods depend on actual supply. Essential fallback does not create free high quality equipment, rare medicine or unlimited luxury stock. Region specialisations influence input access and productivity within tested caps.

Agriculture, manufacturing, mining, energy, ports, tourism, technology and government services have explicit production or service recipes. Safety inspections and maintenance affect downtime and risk. A resource node has depletion and regeneration rules; equipment, labour and transport are costed rather than decorative.

## 4.5 Orders warehousing and logistics

An order progresses from quoted to funded, stock reserved, picked, carrier assigned, dispatched, in transit, delivered and accepted. Exceptions include rejected, delayed, damaged, partially delivered, refunded and disputed. A cancelled order cannot remain simultaneously payable and refundable.

Warehouse space is finite. A shipment has custody records, origin, destination, manifest, route, vehicle, driver, promised window, costs and insurance. Goods do not teleport between states. Travel and loading consume time. Players can drive routes; NPC carriers complete unfilled essential demand at visible rates.

Road conditions, fuel price, security, weather and vehicle wear affect quotes and delivery. Disconnection alone does not destroy cargo. Custody determines who bears covered loss; disputes use game records and agreed contracts. Failed carriers trigger reassignment or a recorded claim, not duplicate delivery.

## 4.6 Companies employment and ownership

Companies support founder, cofounder, shareholders, CEO, managers and employees. Ownership percentages sum to 100% across issued shares; cap table changes require a validated transfer, issuance or approved buyback. A job title does not itself confer asset ownership. D09 settles the mechanics for share issuance and securities activation.

Company accounts and assets remain separate from the owner's personal finances. Permissions cover hiring, payroll, inventory, pricing, supplier orders, debt, dividends and asset disposal. Material acquisitions, large borrowing and ownership changes require the constitution's approval threshold. Proposed default: protected asset transactions require two authorised approvals where the company has multiple controllers.

Payroll reserves committed wages before a shift begins, or the platform supplies an explicitly capped wage guarantee funded by a disclosed account. Companies cannot advertise unlimited unfunded paid work. Workers see arrears and may raise claims. D10 fixes the reserve horizon and wage protection limits.

Companies need supplier contracts, customer service, reviews, maintenance, safety, licences, electricity, staff and taxes appropriate to their sector. Loss of one manager initiates succession. Company deletion requires liabilities, assets and contracts to be resolved through liquidation; it is not an escape from debt.

## 4.7 Bankruptcy mergers and acquisitions

Insolvency creates a staged process: distress warning, creditor protection if available, restructuring, approved acquisition or liquidation. Employee arrears, customer deposits, secured obligations and ordinary creditors have a published priority. Exact ordering is an in game rule set under D11, not an assumed real law.

An acquisition checks authority, escrowed purchase funds, liabilities, licences, workforce terms and ownership conflicts. Assets and contracts transfer once; valuations and price remain in the record. A merger cannot launder disputed funds or erase evidence. Bankruptcy preserves retraining, starter work and housing recovery for affected citizens.

## 4.8 Banking savings lending and financial markets

NPC banking supports the baseline economy. Player operated financial institutions require a licence, reserve policy, liquidity monitoring, scoped staff access and insolvency handling. Savings products disclose rate, funding source, withdrawal rules and risk. Interest is paid from actual provider resources or a declared subsidy account.

Loans specify principal, interest calculation, instalments, maturity, collateral, late fees, hardship options and default process. Affordability checks consider recurring income and existing obligations. Debt cannot create indefinite forced work or remove a citizen's access to the foundation programme and basic care. Educational lending supports grants and income sensitive restructuring where configured.

Financial markets are implemented as a controlled module with company securities, disclosures, exchange order matching, settlement, ownership limits and manipulation review. Real money does not buy virtual investment returns. Trade matching locks funds and securities; partial fills and cancellations reconcile exactly. Final market mechanics and eligible products are an open design gate under D09.

## 4.9 Property utilities and vehicles

Property records land or unit identity, owner, tenants, permissions, rent, maintenance, safety, tax and service connections. Purchase and tenancy use contracts and escrow. Eviction follows a notice and review process with starter shelter fallback. A landlord cannot empty a tenant's personal account or storage through a role permission.

Residents can buy multiple furniture models and sets, retain personal ownership, place and rotate items, move them into storage, and customise finishes, walls and floors. Interior partitions and doorway passage use versioned owner permissions and recorded material/labour inputs. Room names and per-room finishes remain resident decoration. Structural changes cannot cross furnishings, block door tiles or strand a floor area. Floor editing must preserve reachable doors and interactions, reject overlaps and occupied tiles, and reconcile saved layouts after reconnect. Tenancy/title changes preserve the departing resident's purchases and revoke obsolete home access. Starter shelter remains usable even without discretionary purchases.

Shared furnishings allocate server-validated use positions with distinct seat anchors. Permission and approach checks precede a claim; occupied positions cannot be claimed twice. Movement, leaving, layout edits and server-time expiry release presentation use without granting another reward. Private availability controls refresh even when a hidden occupant's pose expires without a business event. Public poses exclude account and command-proof identities. See docs/shared-furniture-use-contract.md and proposed D30 component parameters; longer activities and occupant path coordination remain in scope.

Homes provide capacity-limited vehicle parking. Parking and retrieval use actual ownership, location and availability; a vehicle cannot occupy two spaces, depart while still stored, or be sold without releasing its space. The mature catalogue, room architecture, furniture supply/manufacturing and vehicle integration are main-build requirements.

Guests use the resident's persisted interior through explicit visit consent, without gaining layout or structural authority. Furniture edits preserve all occupants' confirmed walkable positions and clear obsolete object-use poses. Tenant invitations survive a title transfer that preserves the tenancy; buying a rented property does not permit landlord entry. Private scene recovery applies consent withdrawal and expiry even when the guest is idle.

Power and water have supply, outages, metering abstraction and bills. Businesses can obtain alternative supply at a real virtual cost. Building quality and fire safety affect risk. Inspections produce actionable repairs and a reasonable compliance window; corrupt inspectors cannot invent unreviewable penalties.

Vehicles have ownership, condition, fuel, insurance, licences, storage and permitted drivers. Public buses, taxis, courier routes, trucking, rail and aircraft services connect to transit and logistics as applicable. Maintenance changes breakdown probability and operating cost. A city with no player drivers retains NPC transport.

## 4.10 Healthcare insurance and claims

Healthcare covers assessment, treatment, medicine, referral, emergency transport, recovery and professional staffing. Game conditions are fictional abstractions; medical gameplay does not provide real diagnostic guidance. NPC services guarantee baseline access. Hospitals require supplies, power, qualified staff and budgets; quality affects treatment time and outcomes within caps.

Insurance policies identify coverage, exclusions, excess, limits, premium and reserve requirements. Claims move through submitted, evidence requested, investigated, approved or denied, paid, and appealed. Claims investigators compare vehicle, property, custody, treatment and incident records. Fraud creates a separate reviewable case; an unusual claim alone is not proof.

Insurers reserve approved payouts, avoid double payment and offer appeal. Mass disasters trigger exposure limits, reinsurance or a defined resolution policy. Players cannot sell unlimited unfunded coverage. The reserve model and claim caps remain D12 balance gates.

## 4.11 Tax public spending assistance and charity

Government collects authorised income, company, property, consumption or transport taxes through the appropriate journal leg. Each tax identifies jurisdiction, basis, rate, cap, exemptions and effective date. Rates have bounded ranges; no official can set a targeted 100% tax on an opponent.

Public treasuries fund salaries, schools, healthcare, roads, emergency services, military support, education grants, unemployment support, business grants and disaster relief. Spending is an appropriation and disbursement process. Assistance checks actual eligibility, budget and past awards. A citizen can understand why a grant was refused and appeal a factual error.

Registered charities use restricted accounts, approved purpose, officers, transparent virtual fund ledgers and audited awards. Food, education, healthcare and relief are supported activities. Scholarship donors can name a programme and receive verified recognition. Grants cannot secretly require political votes or access to private ballots.

## 4.12 Economic indicators and anti exploit controls

Track inflation using a published basket; employment with a defined active citizen denominator; wage distributions; poverty bands; business survival; supply concentration; educational access; treasury health; inequality; social mobility and regional service availability. Charts show period, sample size and methodology. Approval numbers cannot be treated as substitutes for these indicators.

Protect transfers, rewards, claims, grants, tuition refunds, trades and payroll with idempotency and server verification. Detect rapid circular transfers, repeated starter creation, collusive reviews, impossible work rates, self dealing and asset duplication. Risk flags open investigation with evidence; they do not silently confiscate funds.

Operator recovery uses a scoped freeze, reconciliation, reversible journal corrections and notices. A macro shock must not be fixed by deleting unrelated citizen savings. Economic changes run in a sandbox simulation and staged world before activation.

# 5 Government law and civic power

## 5.1 Constitutional model

The government is a bounded fictional system inspired by Nigerian federal, state and local structures. The game constitution is the authoritative rule set. Real statutes or constitutional provisions are not automatically imported. Rules are versioned, published and taught through the foundation and specialist programmes.

Government contains president, governors, local officials, legislatures, ministers, agencies, judiciary, police, military and civil service. Political authority applies to the citizen's world and jurisdiction. Platform moderators and technical administrators are separate from elected officers; becoming president never grants access to moderation tools, private messages or server secrets.

## 5.2 Authority matrix

| Role | Permitted powers | Required constraint |
| --- | --- | --- |
| President | Federal proposals appointments budget execution national coordination | Appropriations legislature review term and jurisdiction limits |
| Governor | State budget proposals services infrastructure state coordination | State appropriation bounded rates oversight and term limits |
| Local official | Local maintenance permits markets community projects | Local budget published fees and appeal |
| Legislature | Debate votes appropriation policy review oversight | Quorum recorded votes conflict disclosure |
| Minister or agency lead | Execute approved portfolio spending and assignments | Delegated scope procurement records budget ceiling |
| Judge | Warrants hearings verdicts sentences appeals within authority | Evidence due process conflict recusal and review |
| Police | Investigation lawful stops arrest evidence case submission | Grounds scoped powers records and independent complaints |
| Military lead | Approved defence security or emergency assignments | Civil authority bounded missions no routine political policing |
| Civil servant | Process permits benefits records inspections | Task scope eligibility rules audit and escalation |

No role can edit a ballot, mint personal money, revoke a rival's account, confiscate arbitrary assets, invent crimes, view unrelated private communications or modify the platform's constitutional safeguards.

## 5.3 Policy budgets and procurement

A policy has proposer, jurisdiction, authority, bounded parameters, estimated cost, consultation window, approval route, start date and review date. A policy proposal is not active until the required vote and validation complete. An expired or superseded policy remains in history.

Budgets move through draft, review, appropriated, allocated, committed, spent and reconciled. An expenditure cannot exceed both the appropriation and available treasury funds. Procurement discloses tender terms, supplier offers, evaluator conflicts, award and milestones. Work completion is verified before milestone payment. Public project failures leave records and remediation options.

Fiscal choices affect services and approval. More generous support can improve wellbeing while using reserves; strict spending preserves treasury capacity while potentially reducing access. Approval cannot be manually set by an official or bought through campaign spending.

## 5.4 Parties campaigning and civic organisations

Parties have registration, constitution, officers, members, dues, internal elections, candidates and transparent accounts. A party cannot sell voter eligibility or guarantee office. Campaigns use in game spending, media, rallies, posters, debates, endorsements and player creativity within disclosed limits.

Businesses and organisations can lobby legally in the simulation through proposals, meetings, public campaigns and transparent virtual contributions. Meetings and donations are logged; conflict rules apply to procurement and policy. Bribery, coercion and hidden exchanges for official decisions are prohibited mechanics subject to investigation.

Workers can form transport unions, medical and teaching associations, business chambers and other professional organisations. They negotiate, publish positions, endorse candidates and arrange lawful demonstrations. A petition records subject, jurisdiction, signatures and threshold; crossing the threshold triggers formal notice and the defined consideration process, not an automatic law change.

Protests use assembly booking, capacity, safety and media coverage. Police manage crowd safety under bounded rules. The game displays verified participating citizens separately from NPC ambience. Civic play cannot target real people or enable unrestricted harassment and violence.

## 5.5 Elections eligibility and ballot secrecy

Election states are scheduled, nominations open, eligibility locked, campaigning, polls open, polls closed, tally verified, results published, dispute period and certified. Each transition has server times and authorised actors. Rules cannot change mid election to remove a candidate or disenfranchise opponents.

Proposed eligibility seed: account age at least fourteen real days, foundation certificate, seven real days of residence in the relevant jurisdiction and one active voting citizen in the world. National and local contests have distinct residency rules. D13 confirms thresholds, terms, candidacy and inactivity treatment before the first election.

Eligibility snapshots freeze before polls open. A unique constraint enforces one ballot per eligible citizen per contest. A request retry returns the same receipt. Account, rate and risk controls identify suspicious voting patterns; shared devices or network addresses alone cannot justify automatic exclusion. New election day accounts cannot qualify through paid bypasses.

Ballots are secret. Eligibility and participation records are separated from encrypted ballot choices using a reviewed design. Public election logs expose counts and process, never a voter's selection. Tamper evident append only records and independent verification protect the tally; ordinary database permissions alone do not establish immutability.

## 5.6 Results recounts disputes and succession

Tallies operate on eligible accepted ballots, with a reproducible audit and a published receipt verification procedure that does not reveal choices. Recount recomputes from retained accepted records rather than opening a second vote. Disputes specify grounds, evidence, filing window and tribunal authority. Outcomes can certify, correct a procedural error or order a bounded rerun under the constitution.

Terms, term limits, resignation, removal, incapacitation and inactivity are recorded transitions. Acting successors receive defined powers for a limited period. NPC administration maintains essential services while vacancies are resolved but does not win elections, vote for citizens or own a permanent mandate.

## 5.7 Police evidence and rights

Each crime definition contains elements, allowed player actions, maximum losses, evidence types, response powers, trial route and sentence range. Evidence categories are witness statements, security footage, transaction records, location logs and game generated forensic records. Evidence has origin, time, custody, access scope and integrity verification.

CCTV, alarms and guards improve detection or prevention under a published probability model. Cameras are game devices with retention and coverage; they do not record users' real surroundings. Investigators cannot inspect unrelated private conversations without the platform's separate authorised safety process.

Stops and arrests require a specific case, grounds, actor, timestamp and rule. Warrants are required for the actions designated by the constitution. Citizens can see the charge, consult a lawyer, request bail where eligible and challenge improper procedure. A statement by an officer is evidence to assess, not a guaranteed conviction.

## 5.8 Courts bail and prison play

Cases progress through allegation, investigation, filing, preliminary review, hearing, finding, sentence, enforcement and appeal. Lawyers represent consenting citizens. Judges receive scoped case material and recuse for conflicts. Verdicts record reasons and the evidence relied on. Acquittal or successful appeal updates eligibility and compensation where the rules provide it.

Bail is a recorded deposit linked to a case, release conditions and return or forfeiture rules. Another citizen can fund it without gaining control of the defendant. Bail cannot be charged twice because of a retry. Paying bail is not paying for a not guilty outcome.

Prisons contain education, work, rehabilitation, lawyer meetings, visitation and appeal tasks. Sentences are capped for playable sessions and display real remaining time. Prolonged confinement still allows useful activity and social protections. Leaving the application does not indefinitely extend a sentence. D14 fixes sentence lengths, permitted actions and rehabilitation thresholds.

Police misconduct and judicial abuse can generate independent complaints. Game officials cannot disable a report against themselves. Platform harassment or account safety incidents go directly to moderation rather than waiting for an in game court.

## 5.9 Security fire safety and military

Private security companies provide guards, alarms and cameras under licences and scoped contracts. Guards have prevention and reporting powers, not automatic police arrest authority. Firefighters respond to incidents; inspectors assess building safety and issue reviewable compliance requirements.

Military gameplay covers academies, branches, logistics, training, approved security missions and disaster assistance. Domestic deployment is bounded by mission, location, time and civil oversight. An election loser cannot use military rank to cancel voting or seize civilian property. Detailed mission and conflict mechanics remain a D15 content gate.

## 5.10 Public approval polls and accountability

Approval is separated into economy, security, healthcare, education and infrastructure. An overall index publishes weights and measurement periods. System indicators and voluntary citizen opinion are shown separately; a single opaque score must not substitute for measurable performance.

Official polls use a stated representative sampling method across eligible active citizens, with sample size and uncertainty. Player media polls disclose their audience and can be unrepresentative. Candidate and government claims can link to verified world statistics. Newspapers, broadcasters and independent journalists can investigate virtual affairs with defamation, privacy and moderation boundaries.

Media freedom and civic conflict do not override block, mute, report or platform safety. Election campaigns can create shareable links and graphics for real social media; imported visitors still pass age, account and residence checks before voting.

# 6 Technical architecture

## 6.1 Architecture baseline

Use TypeScript for the browser and authoritative service contracts, locally served Three.js for the main 3D world with Canvas fallback, an accessible DOM interface for the phone and administrative tools, PostgreSQL for durable state, and Supabase as the proposed managed authentication, database, storage and low frequency realtime provider. These are architecture recommendations; final versions, providers and hosting contracts are recorded under D16 after a working technical spike.

Fast movement and combat or crime interaction require an authoritative zone service. Supabase Broadcast is appropriate for authorised notifications and synchronisation signals, but is not a durable ledger or a guarantee of massive concurrent movement capacity. A missed broadcast must be repairable from persisted state. Benchmark before committing to connection counts, instance capacity or cost.

Proposed service boundaries are identity; citizen lifecycle; economy and contracts; world and zone simulation; education and careers; institutions and civic affairs; social and media; entertainment and audio; moderation and support; configuration and operations. Begin with a modular service application and clear domain contracts rather than forcing every module into its own microservice. Independent zone processes and background workers have separate scaling needs.

## 6.2 Data and control paths

The browser submits an authenticated command to a domain API. The API validates world, role, state, feature entitlement and idempotency; commits a transaction and an outbox event; then returns authoritative state. Background workers deliver the committed event to downstream services and notifications. Realtime messages prompt clients to refresh or apply a sequenced update.

The zone service receives movement intentions, enforces collision and speed, and publishes nearby state. It does not accept wallet balances, inventory awards or votes from clients. Economic interactions call the durable domain API. Storage serves approved assets and media through controlled URLs and CDN distribution.

Administration operates through a separate scoped API with elevated authentication. Service credentials remain server side. Database row policies reinforce world, tenant and object access; an API authorisation check does not replace storage or realtime access policies.

## 6.3 Zones travel and world scaling

Cities, neighbourhoods, buildings and venues use interest management so a citizen receives nearby movement and relevant service events rather than every national update. Visual crowd instances share durable businesses, events, elections and treasuries. Capacity and queues are visible; joining a second instance does not issue duplicate stock, tickets, votes or office ownership.

Cross zone travel obtains a transfer ticket, saves source state, grants a single destination lease and confirms arrival. A disconnect resumes the same transfer. At most one zone has authority over a citizen at a time. Interstate travel and shipment routes remain logical national connections even when scenes are instanced.

Proposed test seed: 100 visible citizens per outdoor instance and configurable venue capacities. This is a load test starting point, not a supported capacity claim. Target national concurrency, geographic footprint and availability zones remain D17 decisions.

## 6.4 Connection recovery and offline behaviour

Use command identifiers, server sequence numbers, durable event cursors and fresh snapshots on reconnect. Nonfinancial UI can optimistically show a pending action, but ownership and spendable balance change only after acknowledgement. A citizen cannot queue offline votes, purchases or claims and later assume they succeeded.

Current main component: durable tab/incarnation epochs fence new commands atomically with world state; settled retries remain recoverable by the original authenticated actor. Fresh reconnect snapshots, private receipt cursors and origin-bound sequenced nearby presence are implemented with privacy/block filtering and bounded transport. See docs/multiplayer-contract.md for the exact limits and evidence. This does not complete nationwide scaling, production capacity, gameplay disconnect grace or the offline/notification contract below.

For a brief drop, interpolate or predict bounded movement and then reconcile with the server. Proposed grace seed is ten seconds. Long disconnects place the citizen in a safe resumable state; they do not teleport through walls or permit disconnected invulnerability abuse. Every financial retry returns the original result or the authoritative failure.

NPC delegated work and subscriptions continue only within prior consent and published limits. Push notifications require opt in, quiet hours and unsubscribe controls. A missed notification is not consent to a new debt or contract. D18 fixes maximum offline obligations and holiday mode.

## 6.5 PWA and low bandwidth delivery

The browser game supports an installable PWA where the device permits it. Native store distribution is a separate packaging decision and is not implied by PWA installation. Cache static art, code and the approved tutorial shell; never cache sensitive private data or an authoritative balance as though it were live.

Current main component: public manifest/icons, explicit installation, content-versioned allowlisted static caching and a public offline recovery screen are implemented. APIs and private state bypass caching, updates preserve pending command intent, and data saver chooses text controls before optional 3D loading. See docs/pwa-delivery-contract.md. Actual worker/PWA installation, supported-device/weak-network performance and broader progressive art/media delivery still require acceptance.

Load zones progressively, use compressed textures, reuse atlases, defer optional voice and music, and provide a text oriented low data view for essential tasks. Data saver disables automatic audio download and prefetch. A citizen can inspect balances, work, lessons and support after a recoverable scene rendering problem.

## 6.6 Performance and availability targets

Proposed engineering targets require measurement on a named baseline Android device and supported browsers. Initial interaction should become usable within five seconds on a stable 5 Mbps connection after a cold load; the initial required payload should target 5 MB or less. Low mode should sustain 30 frames per second at the chosen instance load. These targets are open under D19 until the device matrix and prototype prove them.

For nonmedia domain commands, target 95th percentile server processing below 500 ms at the agreed load, excluding the user's network. Financial correctness takes precedence over animation responsiveness. Reconnect should reconcile durable state within five seconds after connectivity returns. Test degraded networks at 300 to 800 ms round trip time and short interruptions.

Proposed service objectives: 99.5% monthly availability for core durable APIs; financial recovery point no more than five minutes; operational recovery within four hours. D20 must fund and approve backup frequency, restore architecture and monitoring before these become service commitments.

## 6.7 Music DJ radio and live events

The club owner assigns an authorised DJ shift and booth. The DJ console contains now playing, queue, next track, pause, crossfade, bounded volume, announcements and approved sound effects. The server checks shift, venue, catalogue permission and command rate before changing playback state.

Persist venue, session, sequence, track, start time, offset, pause state and queue version. Clients obtain a snapshot and synchronise playback from server time, then receive small control events. Late joiners seek to the current position. Reconnect fetches the latest sequence. Repeat or reordered commands cannot restart an old track after a newer one.

Approved audio travels from storage or an authorised media provider to the listener's device. The realtime service carries control messages rather than full length music. Listener mobile data and provider delivery costs both exist; cost modelling must include egress, transcoding, storage, connections and moderation.

Spatial gain and panning depend on character distance, room and accessibility settings. Audio begins only after a permitted user interaction; blocked autoplay shows an Enable sound control. Cross origin media must support the intended Web Audio usage. Low data mode offers lower bitrate or mute. Text announcements and captions preserve essential information without sound.

Catalogue categories are owned or directly licensed game music, creator submitted music with recorded distribution permission, and commercial music with the required authorisation. Upload enters quarantine, validation, rights review, moderation, catalogue approval and publication. Rights expiry or withdrawal prevents new playback and safely skips affected queued tracks.

Artist profiles, releases, bookings, concerts, followers, charts, radio, sponsorships and DJ competitions are integrated with events, payments, media and reputation. There is no assumption that a user subscription to another music service permits redistribution. Live DJ audio is a built and separately gated capability requiring moderated ingest, distribution, recording policy, rights controls and a tested cost model. D21 settles those conditions before activation.

## 6.8 Security and abuse boundaries

Authenticate sessions, enforce short lived scoped tokens, separate server secrets, validate inputs, rate limit by operation and restrict media types. Financial, electoral and professional APIs must ignore forged client role fields. Detect impossible movement, reward farming, replayed commands and unauthorised object access.

Account recovery invalidates compromised sessions. Material administrative actions require step up authentication and a reason. Protect public campaign pages, uploads and rich text from script injection. Dependency versions are pinned and scanned before release; changing a package version requires relevant regression checks.

## 6.9 Test environments and deployment

Maintain isolated development, simulation, staging and production worlds. Test money and accounts never become production entitlements. Use schema migrations, contract tests, content validation and rollback procedures. Feature activation cannot substitute for a migration or an application deployment when code is missing.

Load tests model movement, payroll, concurrent purchases, elections, audio control, reporting and support simultaneously. The definition of ready includes server cost per active citizen and per listener hour. A prelaunch systems completion milestone precedes the public activation programme.

## 6.10 Rules engine and simulation clock

Separate configurable rules from code while keeping both versioned. A ruleset defines production recipes, fees, qualification prerequisites, tax bounds, needs rates, event weights, protection periods and institutional permissions. Validate units, ranges and dependency references before a ruleset can be scheduled. A content edit cannot bypass server authorisation or alter past settled transactions.

Record the ruleset version used for each material decision. Existing loans, insurance policies and employment terms retain their contracted versions unless the contract permits a prospective change. Price quotes have an expiry and an accepted price record. Citizens receive notice before a policy or service change takes effect.

Scheduled jobs use stable identifiers, server deadlines and a lease so two workers do not execute the same payroll, event or exam unlock concurrently. After an outage, catch up in bounded batches and prioritise essential obligations. A large backlog cannot instantly apply months of survival penalties or charge unbounded fees. D05 and D18 set permitted catch up limits.

Simulation workers preserve reproducible seeds and relevant input snapshots for shocks, NPC events and probability based outcomes. Operators can replay a case in an isolated world to understand the decision. Replay never writes into the live ledger or reshuffles a published family assignment.

## 6.11 Asset and media ingestion

World assets and user media use separate publication pipelines. Validate file type, size, dimensions or duration, decode safety and ownership metadata before publication. Uploads enter restricted staging; approved derivatives receive content identifiers and delivery permissions. Rejected files cannot become publicly available through a guessed URL.

Voice notes, artist tracks, posters and event graphics have distinct access and retention rules. Remove an asset through a versioned withdrawal while preserving the minimum restricted evidence required for an open dispute. Catalogue removal invalidates future client fetches and triggers appropriate player notices without deleting unrelated event or payment records.

# 7 Database commands and event architecture

## 7.1 Common record rules

Every durable entity has a stable identifier, world scope where relevant, creation time, modification version and lifecycle state. Money uses integer minor units; timestamps use UTC; UI converts deadlines to the viewer's timezone. Version checks reject a stale write rather than silently replacing a newer decision.

Sensitive profile, account, moderation and ballot data is separated from publicly inspectable game records. Public history can use a persistent citizen pseudonym without exposing a person's account identity. Retention and account erasure rules are settled under D22 before social and media activation.

## 7.2 Logical entity inventory

| Domain | Core entities | Important invariants |
| --- | --- | --- |
| Identity | accounts citizens profiles sessions consents residency | Unique voting citizen per account and world |
| Geography | worlds states districts zones routes zone leases | One active authority lease per citizen |
| Households | households members invitations contributions events | Membership consent and separate personal ownership |
| Education | courses curricula lessons enrolments exams attempts certificates licences | Certificates reference curriculum and exam versions |
| Employment | vacancies applications interviews contracts shifts payroll | Earned work settled once funded obligations tracked |
| Business | companies memberships roles cap tables resolutions | Issued ownership reconciles and assets belong to company |
| Economy | accounts journal batches journal lines escrows obligations | Balanced immutable journal and valid available funds |
| Goods | catalogue recipes stock batches reservations custody | Quantity conserved except recorded production or consumption |
| Logistics | orders warehouses shipments manifests deliveries incidents | One settlement and custody chain per fulfilment |
| Property | properties tenancies utilities inspections maintenance | Ownership and possession distinguished |
| Transport | vehicles permits journeys fuel maintenance routes | No duplicated vehicle ownership or active trip |
| Healthcare | facilities providers treatments referrals supplies | Clinical actions require current game credentials |
| Insurance | policies claims evidence reserves decisions payouts | Covered claim paid once from sufficient reserved funds |
| Government | offices terms delegations policies budgets appropriations tenders | Expenditure within authority appropriation and cash |
| Elections | contests candidates eligibility snapshots participation encrypted ballots tallies disputes | One accepted ballot per contest and eligible citizen |
| Justice | cases charges evidence custody warrants hearings verdicts sentences bail appeals | Adjudication and confinement follow state and jurisdiction |
| Social and media | conversations messages voice notes posts reviews polls blocks reports | Consent scoped visibility verified review eligibility |
| Organisations | parties unions associations charities scholarships | Role scope contributions and awards logged |
| Entertainment | venues bookings events tickets RSVPs clubs teams seasons | Capacity reservations and ticket settlement conserved |
| Music | tracks rights grants artists playlists playback sessions | Approved rights and monotonically ordered playback state |
| Emergency | hazards declarations assignments exposure relief repairs | Scoped authority and one award per approved exposure |
| Operations | flags bundles schedules notices audit support sanctions jobs outbox | Versioned configuration audit and retry safe jobs |
| Legacy | contributions landmarks endowments history stewardship | Recognition tied to verifiable underlying records |

This inventory is a logical schema contract. Implementation requires versioned migrations, indexes, row policies, field validation and deletion rules; table names alone are not schema completion.

## 7.3 Command envelope and response

A durable command includes command_id, command_type, actor identity from authentication, world_id, target_id, expected_version, submitted payload and client request metadata. Server time is authoritative. An idempotency record stores actor, operation, key, payload hash, status and result. Reusing a key with a different payload is rejected.

Proposed representative commands are TransferFunds, AcceptEmploymentOffer, SettleShift, ReserveInventory, DispatchShipment, ConfirmDelivery, EnrolCourse, SubmitExam, IssueLicence, SubmitClaim, DecideClaim, CastBallot, IssueWarrant, SetBail, ExecuteBudgetPayment, SetDJTrack and ActivateReleaseBundle.

The response provides success or reason code, committed record version, resulting permitted state and receipt where relevant. Reasons are plain and actionable: funds reserved, credential expired, election closed, role not authorised, capacity full or request already completed. Private evidence is not included in a general error response.

## 7.4 Atomic purchase example

Buying the final stocked item locks or otherwise serialises the inventory reservation and buyer's spendable funds. In one database transaction it validates price and stock, reserves quantity, creates order and escrow, writes balanced journal lines, records the command result and inserts an outbox event. Any failed validation aborts all changes.

Shipment dispatch consumes the reservation into in transit custody. Delivery creates destination stock and the permitted escrow settlement. A unique fulfilment identifier prevents a repeated delivered event from adding stock or money twice. A failed downstream notification does not reverse a successful purchase; reconnect reads the committed receipt.

## 7.5 Event envelope and processing

Each event includes event_id, event_type, schema_version, aggregate_type, aggregate_id, aggregate_version, world_id, occurred_at, actor reference, correlation_id, causation_id and payload. Public, private and restricted variants prevent leaking full records to broad channels.

The transaction commits an outbox entry with the domain state. Workers deliver at least once, so consumers record handled event identifiers and apply idempotent effects. Ordering is guaranteed or checked within each aggregate; consumers reconcile missing versions from a snapshot. Cross aggregate operations use an orchestrated saga with reservations and compensating actions when one transaction cannot cover the entire workflow.

Examples are CitizenCreated, HouseholdJoined, CoursePassed, LicenceIssued, ShiftCompleted, PayrollSettled, StockProduced, ShipmentDispatched, DeliveryConfirmed, RoadConditionChanged, PolicyActivated, ClaimDecided, BallotAccepted, ElectionCertified, CaseAdjudicated, PlaybackChanged and ReleaseActivated. BallotAccepted contains receipt and participation data for authorised processing, never a public choice payload.

## 7.6 Important lifecycle definitions

| Aggregate | Normal transitions | Guard or recovery |
| --- | --- | --- |
| Enrolment | Enrolled lessons complete exam eligible passed certified | Failure allows review and retake no duplicate certificate |
| Employment | Offer accepted probation active suspended terminated | Termination preserves outstanding wage settlement |
| Shipment | Reserved picked dispatched in transit delivered settled | Loss or dispute stops incompatible final settlement |
| Claim | Submitted investigating decided reserved paid closed | Appeal can reopen decision without duplicate payment |
| Election | Scheduled nominations snapshot campaigning voting tally disputed certified | Closure enforced by server clock certification blocks new votes |
| Case | Filed reviewed heard decided sentenced appealed closed | Successful appeal corrects confinement and eligibility |
| Budget | Proposed appropriated allocated committed disbursed reconciled | Cash and appropriation constraints both apply |
| Release | Draft validated scheduled activating active frozen retired | Dependency closure and existing obligation handling |

## 7.7 Audit retention and observability

Audit records capture actor, role, target, reason, prior and resulting state hashes, request identifier and time. Store protected copies and verify integrity; a log in the same mutable admin database is insufficient to claim tamper resistance. Separate user facing histories from restricted security logs.

Metrics include command errors, reconciliation discrepancies, duplicate prevention, event lag, movement corrections, reconnect success, unavailable services, payroll arrears, claim delays, report queues, election eligibility anomalies and configuration changes. Every alert identifies an accountable operator and a runbook.

Privacy retention is purpose limited. Location detail, voice recordings, chats, uploads and identity verification require explicit schedules under D22. Financial and civic history retains the necessary pseudonymised integrity record. Erasure cannot silently unbalance the economy or corrupt accepted election counts.

## 7.8 Data restore and reconciliation

Back up durable state and configuration, verify backup integrity and practise restoration in an isolated environment. Reconcile total journal debits and credits, escrow liabilities, company assets, goods custody and election snapshots after restore. Event workers resume from a safe cursor without paying old wages or claims again.

The restore procedure communicates the affected time window and gives citizens a route to contest a missing transaction. Recovery does not assume browser local state is authoritative. The production launch gate requires a successful timed drill against D20 targets.

# 8 Administration support and operations

## 8.1 Administrative roles

The administration dashboard separates platform authority from in game government. Staff accounts use least privilege, session auditing and stronger authentication. No routine account has every power. Emergency super administration is a separately controlled capability with recorded use and review.

| Staff role | Main responsibilities | Restricted actions |
| --- | --- | --- |
| Super Admin | Staff grants emergency access constitutional configuration | Exceptional use requires reason and review |
| Game Moderator | Reports chat voice social content harassment sanctions | Cannot mint money alter ballots or decide ordinary court cases |
| Economy Admin | Balance diagnostics controlled interventions reconciliation | No direct balance editing or unrecorded gifts |
| Support Agent | Tickets receipts account recovery escalation | Cannot inspect unrelated private material or override elections |
| Content Admin | Curriculum assets approved events music catalogue | Cannot certify personal qualifications or ignore rights review |
| Technical Admin | Availability migrations backups deployments incident response | Cannot silently change financial or election outcomes |

Proposed default: high impact staff grants, economic corrections, sensitive data access and national configuration changes require two authorised staff approvals. Break glass recovery has a time limit, complete audit and subsequent independent review.

Implementation checkpoint, 8 October: the local scoped staff-grant component uses recent verified TOTP MFA, exact terms and two distinct current authorities for grants/revocations. The dashboard, private mirrors, session/audit proof and safe receipt recovery are tested; initial trusted setup is an offline operator action. This does not complete R058, the wider dashboard, emergency recovery or independently protected audit copies. The hosted staff migration remains unapplied after automatic approval review rejected the DDL change under the publication hold. See docs/staff-authority-contract.md. Its fifteen-minute MFA/review windows, thirty-day grant ceiling and two-role routine limit are operational defaults requiring prelaunch review.

## 8.2 Dashboard capabilities

Provide scoped views for active worlds, service availability, citizen support, moderation queues, economy indicators, treasuries, NPC coverage, entity health, jobs and event processing, feature bundles, announcements, scheduled releases, assets, curricula, music rights and restore readiness.

Every control shows current value, permitted range, affected scope, dependency impact, effective time and preview. A rate change or disaster declaration shows expected consequences before commitment. A failed command gives a clear reason and does not leave an ambiguous half applied national configuration.

## 8.3 Feature flags and bundle activation

Flags are server enforced capability controls. Record key, description, owner, scope, state, dependency keys, eligible cohorts, implementation version, configuration version, start time, retirement plan and emergency freeze behaviour. Client menus reflect server entitlement; a hidden button cannot be the only access control.

Flag states are built and closed, internal testing, limited public cohort, active, frozen to new activity and retired. Completion status is separate: specified, implemented, integrated, tested and approved. An unimplemented capability never appears as ready merely because its flag exists.

An activation bundle includes compatible code and schema versions, validated content, dependency closure, NPC staffing, economic budget, permissions, observability, rollback instructions, announcement and support training. Scheduling requires all gates to pass. The activation transaction records the final configuration and emits ReleaseActivated once.

Dependencies can be satisfied by active player services or approved NPC fallback. A launch shop can trade while player manufacturing is closed because baseline NPC supply exists. Police cannot be active without a functioning adjudication and appeal route. School certificates cannot require a disabled lesson with no equivalent fallback.

## 8.4 Freeze rollback and existing commitments

A freeze usually stops new commitments while allowing safe completion, withdrawals, refunds, delivery, claim settlement and appeals. Disabling insurance cannot erase policies. Closing education cannot delete certificates. Retiring a market must settle or cancel open orders and preserve ownership. Each domain declares its wind down process.

Configuration rollback restores a previous compatible version. Code rollback and data reversal are separate procedures. Paid wages, accepted ballots and delivered goods cannot be erased simply by toggling a feature off. Corrections use domain rules and journal reversals with visible receipts.

## 8.5 Moderation and privacy

Support block, mute, report, rate limits, anti spam, harassment review, private message controls, voice note reporting, upload review and appeals. Blocking prevents direct contact and unsolicited invitations; role or party membership cannot override it. Public service interfaces offer neutral channels so blocking does not remove access to healthcare or legal rights.

Reports attach scoped evidence such as message identifiers, voice timestamps, transaction receipts and relevant events. Moderators receive only the material required for the case. Reporters are not publicly identified to an alleged abuser. Enforcement includes warning, content removal, communication restriction, temporary suspension and permanent account sanction according to published severity rules.

Voice notes have duration and upload limits, explicit recording indicators, recipient permissions and report controls. Access to reported audio is logged. Automated flags assist human or authorised review; appeals remain available. Moderation capacity is a launch dependency for all public communication features.

## 8.6 Customer support

In game tickets cover missing assets, uncredited platform payments, abusive officials, ballot receipts, hacked accounts, failed deliveries, wage arrears and accessibility problems. Tickets have category, priority, owner, timeline, linked receipts, resolution, citizen response and appeal state.

Support agents inspect transaction receipts and scope relevant logs without requesting passwords. Compromised account recovery revokes sessions and reviews disputed actions. Restitution needs evidence, authority and balanced correction entries. A citizen cannot obtain a second asset by reporting a delivery that already has a valid receipt.

Proposed response targets: urgent account compromise and widespread financial incidents triaged within one hour while staffed; ordinary tickets acknowledged within one working day. D23 fixes coverage, staffing and realistic commitments.

## 8.7 Announcements maintenance and notifications

Announcements have local, state, national, emergency and update scopes. Routing uses citizen location, residency, subscribed interests and severity. A local traffic notice should not alert every world. Governors publish only within their authority; emergency priority has rate limits and misuse review.

Planned maintenance gives warning, stops unsafe new commitments, checkpoints zones and returns a recovery status. Unplanned incidents prioritise durable correctness and citizen communication. Notifications support opt in, quiet hours, digest options and accessible text. No important rule exists only in a temporary push message.

## 8.8 Operational controls and cost management

NPC operators can adjust coverage, not create hidden unlimited supply. Economy operators use bounded parameters and staged simulations. Content operators preview an event footprint and risk. Support and moderation see service status so they can give accurate responses.

Track active users, concurrency, audio listener hours, asset transfer, database volume, event backlog, storage growth and staff workload. Budgets include hosting, audio delivery, rights, moderation and support. A cost limit can reduce optional visual or audio quality, but cannot corrupt durable balances or deprive citizens of paid entitlements without a defined refund process.

## 8.9 Platform monetisation and payment fulfilment

Permitted categories are cosmetics, cosmetic branding, membership features and convenience that does not change competitive or professional outcomes. Party branding and campaign presentation can be commercial services only with a free functional path to political participation and equal voting rules. Final permitted products are reviewed under D07.

Do not sell votes, candidacy bypasses, office, exam passes, stronger professional outcomes, wealthy family rerolls or guaranteed investment returns. Cosmetic status and real purchasing history are unavailable to ballot weighting and job eligibility logic. Virtual tuition is an economy expense, not an automatic source of real company revenue.

Real payments use a separate provider integration and verified server callbacks. Payment records progress through created, pending, verified, entitlement granted, refunded or disputed. Callbacks and retries grant an entitlement once. Reconciliation compares provider receipts with fulfilment records. Refund and chargeback handling cannot silently debit unrelated virtual wages.

## 8.10 Product review gates

Before opening the public service, settle adult eligibility, privacy and retention, player terms, game crime boundaries, creator rights, payment fulfilment and applicable service obligations with qualified reviewers. These gates are operational tasks with named owners and dates; this bible does not itself grant rights or legal approval.

# 9 User experience and visual system

## 9.1 World presentation

The owner rejected the small toy-like character and rigid movement. The main game's art goal uses mature adult proportions, detailed furniture and believable directional walking, with The Sims 1–4, My Life in New York and Lagos Life as life/home experience references, and OneState RP and MadOut as connected-city/vehicle presentation references. Read docs/reference-game-study.md for source evidence, uncertainty and measurable quality gates. The previous prototype does not approve the final art direction. The current main implementation uses locally served Three.js for an orthographic 3D cutaway world, with Canvas and accessible DOM fallbacks. Its procedural articulated adult and fourteen furniture models are an implementation baseline; cultural review, production asset quality, camera/device usability and animation acceptance remain D24 gates. No copied franchise assets are required.

The user's 8 October visual direction requires entering homes, seeing their furnishings and approaching objects for contextual interaction. Direct floor selection offers a placement draft with explicit server-validated saving; keyboard placement remains available. Click-to-walk and selected-object approach must use authorised adjacent movement, interact only after confirmed arrival and stop on uncertain responses, blur or a changed account/location/layout. Resolving a pending move must not silently resume a route or object action. Characters must remain readable at the default view and visibly face front, back, left and right. Held movement controls support walking without repeated individual button presses; animations follow confirmed movement and respect reduced-motion settings. Home objects have appropriate contextual actions, and interiors support multiple furniture purchases and saved placement. The camera supports touch dragging, screen scrolling, zoom and return-to-character controls. Connected neighbourhoods extend beyond the starting street; a representative prototype does not establish completion of the nationwide map or full interior simulation.

The main-build residence component now ties owned/rented home entry and parking to distinct authored street entrances. Changing residence stores personal furnishings, releases parking, exits the old room and preserves title and contractual obligations. A completed owned home can be selected explicitly. Distance-driven gait and two-link leg contact now keep stance feet grounded; seats use cushion heights, beds align lying bodies, and standing activities face the object. Original head geometry and idle blinking improve the current procedural baseline. Numerical/geometry and HTTP/DOM/PostgreSQL checks are component evidence; full production art, guests, nationwide property lots, floors/extensions and browser/device acceptance remain open. Read docs/residence-and-motion-contract.md.

Jobs, queues, transport, services and social activity remain visible. Objects have consistent labels and accessible focus. Buildings show purpose, opening state and service; a closed clinic directs citizens to an alternative or NPC fallback.

## 9.2 HUD phone and interaction model

The HUD shows needs, safe or protected status, current activity, nearby interaction and connection state. Money is visible without turning every scene into a financial dashboard. The in game phone hosts bank, jobs, school, map, messaging, NaijaFeed, organisations, events, government, emergency help, support and settings.

Movement uses touch and keyboard options. Context actions show only available operations and the reason a locked action is unavailable. Sensitive actions such as debt, contract acceptance, asset sale or a ballot use a clear review step. Confirmed financial actions show a receipt. Connection loss marks a pending action and reconciles it before offering another payment.

## 9.3 Accessibility requirements

Support keyboard navigation, visible focus, text scaling, comfortable touch targets, sufficient contrast, noncolour indicators, captions or transcripts for important audio, separate audio controls, reduced motion and accessible task alternatives. Core bank, education, application, voting and support flows are usable through accessible DOM controls rather than only painted canvas text.

Proposed target is WCAG 2.2 AA for the web interface, with explicit game interaction accommodations and a tested accessibility matrix. This is a target requiring verification, not a claim of achieved conformance. Public content and player media preserve readable text and report controls.

## 9.4 Graphics and data settings

| Setting | Visual behaviour | Shared gameplay rule |
| --- | --- | --- |
| Low | Minimal shadows fewer ambient NPCs reduced particles and animation | Same collisions rewards visibility of essential cues and legal rules |
| Medium | Moderate lighting traffic and effects | No extra economic or competitive information |
| High | Richer lighting ambient crowds and environmental motion | No increased rewards or exclusive interaction reach |
| Data saver | Reduced optional media compressed assets no automatic music | Essential work education bank and civic access preserved |
| Reduced motion | Limited camera effects flashes and movement decoration | Equivalent tasks and outcomes |

Ambient NPC density is visual only; reducing it does not secretly reduce essential service capacity. A lost WebGL context or scene failure offers recoverable reload and accessible essential menus. Audio preferences persist, and music never masks emergency text.

## 9.5 Social discovery and player media

NaijaFeed supports citizen and organisation profiles, posts, comments, follows, local discovery, event listings and controlled paid promotion. Feeds distinguish ads, verified government notices and ordinary player posts. Privacy settings limit personal visibility, presence, location and direct messages.

Media companies employ journalists and production staff, publish news, interviews and polls, and earn contracted virtual advertising or subscription income. Creators negotiate sponsorships and events. Metrics resist artificial engagement and collusion; verified records support factual claims. Role badges do not guarantee trust.

Public sharing produces an event or campaign page with safe metadata, invitation links and optional graphics. Guests see the game identity and join path; privacy restricted posts, medical cases and legal evidence are not exposed. Referral rewards, if introduced, cannot accelerate ballot eligibility or inflate currency unchecked.

## 9.6 Clubs events sports and ordinary leisure

Clubs employ owners, managers, DJs, bar or food staff, security, cleaners, promoters and photographers. They require property, licence, electricity, stock, staff and marketing. Revenue includes tickets, tables, food, sponsorship and advertising; expenses include wages, utilities, rent, tax, maintenance and entertainment. Operating rules are bounded and reviewable.

Player events contain host, venue, real date, timezone, performers, capacity, ticket price, cancellation policy and moderation contact. Discovery appears in local listings, the venue page and NaijaFeed. RSVP is distinct from a paid ticket. Ticket inventory reserves once; cancellation triggers the promised refund. Venue capacity includes all visual instances sharing the event if tickets are sold nationally.

Sports cover club ownership, teams, recruitment, training, fixtures, officials, injuries, seasons, sponsorship, ticketing and results. Proposed initial playable sport is football; D25 fixes match mechanics and the wider sport catalogue. NPC participants and fixtures keep the schedule alive when players are absent. Outcome verification prevents client reported wins and repeated reward collection.

Friendships, dates, festivals, weddings, nightlife, sport and hangouts are supported leisure activities. Consensual invitations, affordable public spaces and NPC events allow a comfortable social life without wealth or political ambition.

## 9.7 Crime groups and consent boundaries

Gangs support voluntary recruitment, roles, reputation, territory activity and bounded missions using the same asset and evidence rules. Leaving and blocking remain available; membership grants no access to private identity or compulsory real payments. Crime exposure protects newcomers and caps repeat targeting. Injuries, losses, police, courts, insurance and rehabilitation connect under D15's tested harm limits and accessible task design.

# 10 Release catalogue and completion gates

## 10.1 Build programme and public releases

The project has one full prelaunch build scope and a separately controlled public release sequence. Work proceeds in dependency order: shared identity and ledger; citizen survival and world travel; education and contracts; production and services; civic institutions; social and entertainment; advanced ownership and legacy; whole world verification. This work order does not defer agreed modules until after public launch.

The public launch gate requires every register item to reach implemented, integrated and tested status, including completed closed modules. Stored updates remain available to internal test accounts and automated acceptance suites. Public opening dates do not assert code is finished until its completion evidence is recorded.

Proposed cadence is a major activation every four to eight weeks when ready, with smaller fixes between releases. The catalogue provides approximately two years of potential announcements if selected, but it is not a date commitment. Releases may be combined, slowed or reordered after dependency and stability review. A competitor appearing does not override readiness gates.

## 10.2 Launch bundle and dependency closure

Proposed launch bundle L00 opens citizens, Independent and Random Family starts, foundation school, starter and basic skilled jobs, baseline companies, housing, banking, vehicles, state travel, healthcare, bounded police, essential social functions and events. NPC production, finance, adjudication, education, transport and government remain operational where player versions are closed.

Starter protection, support, moderation, accounting, audit, recovery, settings, access controls and NPC fallback are always active service capabilities. They cannot be withheld as later paid or promotional updates. Player police opening requires an active court route and appeal even if the expanded judiciary presentation is scheduled later.

## 10.3 Stored public activation catalogue

Every row below is built and tested before launch. “Prerequisite” means active service or validated NPC equivalent, not merely a named feature flag.

| Bundle | Public expansion | Main prerequisite |
| --- | --- | --- |
| U01 | Player households richer family events and shared homes | Consent property household accounts support |
| U02 | Vocational schools apprenticeships mentoring | Curriculum exams licences employment |
| U03 | Hiring interviews unions and associations | Contracts payroll organisations moderation |
| U04 | Warehouses trucking and logistics companies | Inventory custody vehicles roads claims |
| U05 | Agriculture food chains and regional markets | Production land water storage transit |
| U06 | Manufacturing mining energy and port businesses | Recipes supply power safety trade |
| U07 | Property development utilities and inspections | Ownership permits contracts service budgets |
| U08 | Specialist healthcare hospitals and medical careers | Qualified staff supplies referrals emergency cover |
| U09 | Insurance investigators and claim appeals | Reserves evidence contracts court fallback |
| U10 | Expanded police private security and CCTV | Evidence warrants complaints licensed roles |
| U11 | Player courts lawyers bail prisons rehabilitation | Due process case transitions confinement limits |
| U12 | Local government policies petitions and protests | Civic eligibility budgets safety moderation |
| U13 | State elections parties campaigns and debates | Secret ballot anti fraud tribunals fiscal controls |
| U14 | National assembly federal offices and budget cycle | State civic services federal constitution elections |
| U15 | Military academies missions and disaster assistance | Credentials civil oversight bounded mission rules |
| U16 | Disaster agency emergency exercises and rebuilding | Exposure relief multi service dispatch insurance |
| U17 | Clubs DJ console radio and nightlife careers | Audio catalogue rights venue capacity moderation |
| U18 | Artists creator music concerts charts and competitions | Rights review bookings media audio cost controls |
| U19 | Football clubs seasons sponsorships and awards | Verified fixtures teams ticketing scheduling |
| U20 | Media companies polls and civic investigations | Publishing privacy evidence sampling moderation |
| U21 | Corporate shares mergers acquisitions and insolvency | Cap tables governance settlement creditor rules |
| U22 | Player banking credit and financial markets | Reserve policy disclosures matching settlement review |
| U23 | Charities scholarships universities and foundations | Restricted funds awards education audit |
| U24 | Landmarks historical archives and extended legacy | Verified contributions stewardship history |

Aircraft or expanded rail operations, live DJ streaming and a commercial music catalogue are included in the implemented domain scope where specified, but their public opening requires the specific content, rights, cost and capacity decisions. Unlicensed catalogue content cannot be manufactured by switching on a flag.

## 10.4 Definition of complete

A requirement is complete only with an approved rule, actual client flow, authoritative API, schema and migration, permissions, durable transitions, dependency effects, NPC or failure handling, admin controls, telemetry, accessibility checks, exploit checks, acceptance evidence and operator documentation.

Completion evidence contains requirement ID, code version, test run, reviewer, applicable configuration and known limitations. One happy path demonstration is insufficient for money, elections, claims and legal authority. All closed features undergo the same integration verification as public ones.

## 10.5 Whole world release gates

- A new citizen can safely spawn, work, study, fail and retry an exam, qualify and receive a higher opportunity without buying premium features.
- Money, escrow, inventory and ownership reconcile after concurrent requests, repeated callbacks and restore.
- Fuel, roads, shipment timing, prices, employment and public indicators show their declared connections without uncontrolled collapse.
- Essential services work during low population, company failure and official inactivity.
- Officials and staff cannot cross their permissions; sensitive actions are auditable and appealable.
- Ballots remain unique and secret, the count is reproducible, and the dispute procedure works.
- Social tools, events and audio can be moderated, reported and used with privacy and accessibility controls.
- Low mode, data saver, brief disconnections and reconnects preserve useful gameplay and financial correctness.
- Closing or freezing a module preserves existing paid obligations and a documented path to settle them.
- Timed restore, incident response, operator training, rights review and funded service capacity pass before launch.

## 10.6 Improvement after the baseline

New ideas enter a change request containing the player need, dependency links, affected records, fairness effect, operational cost, release impact and acceptance tests. Approved changes update the bible and completion register before implementation. An urgent bug fix can use the incident path and receive documentation immediately after stabilisation.

The current product requires a substantial multidisciplinary build. This specification defines scope and readiness; it does not establish a staffing budget or guaranteed completion date. D26 records delivery capacity and a realistic work plan without removing the user's all systems prelaunch requirement.

# 11 Requirements and coverage register

## 11.1 Register rules

Every requirement below is in prelaunch implementation scope. Initial delivery status is Specified; implementation, integration and test evidence must be added as work occurs. The rule text in the referenced section controls. A title in this index does not replace its detailed contract.

| ID | Required capability | Main section | Acceptance |
| --- | --- | --- | --- |
| R001 | Nigerian national geography and regional identity | 1.3 | A01 A08 |
| R002 | World separation and one authoritative zone | 1.3 6.3 | A08 A24 |
| R003 | Atomic account citizen and starter provisioning | 2.1 | A01 A02 |
| R004 | Independent start and baseline shelter | 2.2 | A01 A03 |
| R005 | Random NPC family start and fair assignment | 2.2 | A03 |
| R006 | Household invitations consent assets and exit | 2.2 | A03 A25 |
| R007 | Evolving NPC personalities finances and obligations | 2.2 11.2 | A03 A18 |
| R008 | Five day in world foundation curriculum | 2.3 | A01 A04 |
| R009 | Citizen exam retries versioned certification | 2.3 | A04 |
| R010 | Day one starter jobs and NPC employers | 2.4 | A01 A18 |
| R011 | Education ladder fees grants and tracks | 2.5 | A04 A05 |
| R012 | Apprenticeships tutors private schools mentors | 2.5 | A05 |
| R013 | Vacancies applications interviews contracts | 2.6 | A05 A06 |
| R014 | Background checks rehabilitation restored eligibility | 2.6 5.8 | A12 |
| R015 | Skills minigames and accessible alternatives | 2.7 | A05 A21 |
| R016 | Scoped reputation verified reviews anti manipulation | 2.7 | A16 |
| R017 | Needs housing rest utilities and offline safety | 2.8 | A01 A17 |
| R018 | Friends partners families and relationship consent | 2.8 | A25 |
| R019 | Multiple life paths and ordinary leisure | 2.7 9.6 | A01 A21 |
| R020 | Life events with caps and recovery paths | 2.9 | A03 A17 |
| R021 | Legacy history landmarks and stewardship | 2.9 | A29 |
| R022 | Explicit inputs outputs dependencies and feedback | 3.1 3.7 | A09 A30 |
| R023 | Essential NPC service fallback | 3.1 3.8 | A18 |
| R024 | Fuel roads transit costs and price propagation | 3.3 | A09 |
| R025 | Agriculture manufacturing mining ports and trade | 3.2 4.4 | A07 A09 |
| R026 | Warehouses stock scarcity and shipment custody | 4.4 4.5 | A07 A08 |
| R027 | Weather disasters emergency coordination and relief | 3.6 | A19 A30 |
| R028 | Balanced virtual ledger reserves and receipts | 4.1 | A02 A06 A07 |
| R029 | Visible issuance sinks and economic balancing | 4.2 4.3 | A09 A30 |
| R030 | Company roles ownership shares and succession | 4.6 | A06 A18 A23 |
| R031 | Bankruptcy mergers acquisitions and creditor recovery | 4.7 | A23 |
| R032 | Banking savings loans markets and reserve controls | 4.8 | A22 A23 |
| R033 | Property tenancy construction maintenance and taxes | 4.9 | A10 A17 |
| R034 | Vehicles fuel licences repair and transport choices | 4.9 | A08 A09 |
| R035 | Healthcare supplies careers and emergency treatment | 4.10 | A05 A19 |
| R036 | Insurance claims investigators fraud review appeals | 4.10 | A11 |
| R037 | Treasuries taxes budgets appropriations procurement | 4.11 5.3 | A10 A13 |
| R038 | Assistance charities scholarships restricted funds | 4.11 | A05 A19 A29 |
| R039 | Social mobility inflation employment and regional metrics | 4.12 | A09 A30 |
| R040 | Anti exploit idempotency collusion review and correction | 4.12 | A02 A07 A16 |
| R041 | Federal state local offices and constitution | 5.1 5.2 | A13 |
| R042 | Parties candidates campaigns endorsements and sharing | 5.4 9.5 | A14 A26 |
| R043 | Lobbying unions associations petitions and protests | 5.4 | A13 A26 |
| R044 | Eligible secret unique votes and tamper evident audit | 5.5 | A14 |
| R045 | Recounts tribunals succession and term limits | 5.6 | A15 A18 |
| R046 | Evidence CCTV alarms private security and warrants | 5.7 5.9 | A12 |
| R047 | Police rights lawyers bail court decisions and appeal | 5.7 5.8 | A12 A13 |
| R048 | Prisons education work visitation and rehabilitation | 5.8 | A12 |
| R049 | Military academies bounded missions civil oversight | 5.9 | A13 A19 |
| R050 | Fire response inspections and safety ratings | 4.9 5.9 | A10 A19 |
| R051 | Five approval dimensions official and media polling | 5.10 | A26 A30 |
| R052 | Authoritative services zones APIs and PWA | 6.1 6.5 | A02 A08 A20 |
| R053 | Latency handling disconnect recovery and safe retries | 6.4 | A02 A08 A20 |
| R054 | DJ permissions synchronised music spatial audio | 6.7 | A27 |
| R055 | Rights creator uploads commercial catalogue live audio gate | 6.7 | A27 A28 |
| R056 | Durable entities migrations commands outbox and lifecycle | 7.1 7.6 | A02 A24 |
| R057 | Audit telemetry backups restore and reconciliation | 7.7 7.8 | A24 |
| R058 | Scoped admin roles authentication and accountability | 8.1 8.2 | A13 A24 |
| R059 | Server flags dependencies schedules freezes and wind down | 8.3 8.4 | A22 |
| R060 | Block mute report voice safety moderation appeals | 8.5 | A25 |
| R061 | Support tickets account recovery and restitution | 8.6 | A24 A25 |
| R062 | Scoped announcements maintenance push and quiet hours | 8.7 | A20 A26 |
| R063 | Adult eligibility privacy and content review | 1.1 8.10 | A25 A28 |
| R064 | Fair commerce real payment fulfilment refunds | 8.9 | A28 |
| R065 | World art phone HUD menus and visible reasons | 9.1 9.2 | A01 A21 |
| R066 | Accessibility keyboard captions scaling and reduced motion | 9.3 | A21 A27 |
| R067 | Low medium high graphics and data saver | 9.4 | A20 A21 |
| R068 | NaijaFeed DMs voice media advertising and privacy | 8.5 9.5 | A25 A26 |
| R069 | Clubs ticketed events capacity bookings cancellations | 9.6 | A27 |
| R070 | Artists radio charts performances and sponsorships | 6.7 9.6 | A27 A28 |
| R071 | Football sports seasons festivals and awards | 1.4 9.6 | A27 A29 |
| R072 | Gangs fictional crime rules losses and recovery | 9.7 | A12 A25 |
| R073 | Full prelaunch completion separate public activation | 10.1 10.4 | A22 |
| R074 | Controlled update catalogue and stability gates | 10.3 10.5 | A22 A30 |
| R075 | Persistent specification memory and change control | 12.4 | A31 |

## 11.2 NPC behaviour contract

NPCs use bounded deterministic state machines or scheduled jobs for essential work. Each has role, location, household or employer link, resource budget, personality profile, availability, relationships, task queue and event history. Personality affects dialogue and optional event choices within the same published legal and financial limits.

Essential service transactions use validated rules. Generative dialogue, if chosen, cannot issue currency, decide guilt, certify a licence, change prices outside the model or overwrite civic rules. NPC actions are audited as NPC actions and do not inflate player attendance, protests, public polls or election totals.

Citizens can inspect whether an opportunity is NPC or player supplied. NPC teachers maintain authoritative rules; NPC officials operate published caretaker policy; NPC employers reserve their issuance budgets. Fallback work cannot silently replace a paid player worker already fulfilling an active contract.

# 12 Decisions acceptance scenarios and project memory

## 12.1 Locked decisions

The following design choices are the baseline product direction: interconnected national simulation; all specified systems built before public launch; dashboard controlled releases; five day foundation education alongside immediate work; NPC controlled official curriculum; citizen examination; education paid with virtual currency above the foundation tier; independent and random family starts; player households with consent; essential NPC fallback; meaningful loss with recovery; bounded institutional authority; unique eligible votes; transparent virtual financial records; low end phone and weak network support; ordinary life as valid success; legacy as the advanced endgame.

Adult initial audience and fair real money boundaries follow the accepted recommendations. A change to them requires a recorded product decision and review of affected social, financial and election rules. Technical providers, numeric thresholds, schedules and balancing values below are proposed details awaiting explicit confirmation or test evidence.

## 12.2 Open decision register

All entries begin as Proposed. Assign an owner, approval date and evidence before the dependent implementation or release gate. Decisions can be settled in batches by discipline; they do not require reopening the entire game concept.

| ID | Decision to lock | Current baseline | Required evidence |
| --- | --- | --- | --- |
| D01 | City district route and geography catalogue | National logical coverage detailed map list to confirm | Regional content review and travel prototype |
| D02 | Characters per account identity and age assurance | One voting citizen per account and world | Abuse privacy and eligibility review |
| D03 | Family distribution reset and starter budget | Distribution in 2.2 no paid rerolls | Mobility and repeated signup simulation |
| D04 | Five day unlock timing exam and accommodations | Rolling daily unlock untimed 80% exam | New citizen usability and education testing |
| D05 | World clock and macro update cadence | Event local hourly regional daily macro | Shock stability and calendar tests |
| D06 | Institutional inactivity delegation and terms | Reminder 72 hours acting seven days review fourteen | Absence and succession simulations |
| D07 | Currency labels store products and provider | Virtual NGN separate cosmetic commerce | Fairness review payment sandbox refunds |
| D08 | Retirement death inheritance and resets | No routine permanent death | Recovery and legacy design |
| D09 | Shares securities and market products | Controlled fictional exchange and company governance | Ownership matching manipulation tests |
| D10 | Wage reserves shift length and dispute limits | Secured committed wages | Payroll insolvency and casual play tests |
| D11 | Insolvency creditor order and acquisition approvals | Published staged resolution | Creditor and asset transfer scenarios |
| D12 | Insurance reserves cover caps and disaster model | Reserved approved payouts bounded risk | Mass claim stress and resolution test |
| D13 | Election ages residence terms candidates quorum | Age fourteen days residence seven days foundation | Anti fraud ballot privacy and election simulation |
| D14 | Court timing sentences bail and rehabilitation | Playable capped detention with appeal | Prison usability and rights tests |
| D15 | Crime territory pursuit and military missions | Bounded voluntary fictional activity | Harm limits permissions recovery prototype |
| D16 | Provider versions server framework and hosting | TypeScript Three.js PostgreSQL Supabase plus zones | Technical spike cost security and capacity |
| D17 | Concurrency instance size geographic hosting | One nation per world seeded 100 visible citizens | Concurrent mixed workload benchmarks |
| D18 | Offline liabilities leave and delegation | Bounded needs and disclosed contractual effects | Long absence financial recovery test |
| D19 | Device browser and performance matrix | Targets in 6.6 | Named low end device and network measurements |
| D20 | Backup availability recovery funding | Targets in 6.6 | Timed restore and incident drill |
| D21 | Music rights live audio commercial catalogue | Approved catalogue control sync | Rights review playback moderation cost model |
| D22 | Privacy retention erasure and evidence access | Purpose limited scoped retention | Data inventory reviewer approval erasure drill |
| D23 | Moderation support coverage and targets | Staffing dependent response targets | Queue simulations escalation coverage plan |
| D24 | Camera art characters animation languages | Mature readable 3D with Canvas and DOM fallbacks; production art pending | World prototype cultural and accessibility review |
| D25 | Sport match mechanics fixture catalogue | Football initial playable sport | Outcome verification and low device playtest |
| D26 | Team capacity build order cost and dates | Full system scope before public launch | Dependency work plan budget milestone evidence |
| D27 | Staff authority windows role limits succession and independent audit protection | Fifteen-minute MFA/review; thirty-day routine grants; two roles and two current grant authorities | Live MFA; expiry staffing; root rotation and independent recovery; protected audit copies; operator review |
| D28 | Reference-game art and interaction acceptance | Mature Sims/My Life in New York life/home depth and OneState/MadOut city presentation | Original production assets; cultural/device/art review; documented reference uncertainty |
| D29 | Home visit duration capacity and permissions | 15/30/60-minute reviewed visits; eight active invitations per home | Consent, tenant continuity, SQL recovery and idle expiry; owner/device/load review |
| D30 | Shared furniture use positions and duration | Three sofa positions; one on other timed fixtures; ten-second presentation window | Receipt-backed SQL recovery; rotated contacts; private expiry; longer activity/traffic and device review |
| D31 | Social invitation safeguards and private history | Opt-in inbox; seven-day pending expiry; twenty pending; twenty outgoing per rolling day; one hundred active; one hundred ended records visible | Mutual consent, leave/block, SQL recovery and private expiry; abuse/load/retention and owner review |

## 12.3 Acceptance scenario catalogue

Each scenario runs in an isolated test world with documented configuration and reproducible starting records. Financial and election cases require database and audit evidence, not only a screen recording. Proposed numeric targets use the approved decision values when available.

| ID | Scenario | Passing result |
| --- | --- | --- |
| A01 | New citizen completes first day through an NPC guide | One citizen bundle shelter meal bank and paid shift available while school remains active |
| A02 | Repeat a payment after timeout and reconnect | Exactly one balanced transaction one receipt no extra reward and correct client reconciliation |
| A03 | Compare poor rich independent and invited starts | No exam bypass personal funds remain private leaving household preserves safe recovery |
| A04 | Complete five modules fail exam retake and pass | Correct unlock schedule failed attempt retains work one versioned certificate unlocks eligibility |
| A05 | Fund education by wages and a scholarship then apply | Restricted award pays approved tuition licence is validated hiring checks credentials |
| A06 | Complete paid work while employer becomes inactive | Earned wages settled once succession or NPC cover handles committed duties |
| A07 | Two buyers request final stock and delivery retries | One buyer obtains the item quantities and escrow reconcile repeated delivery adds nothing |
| A08 | Transport citizen and cargo across zones with disconnect | One zone lease one shipment custody route time preserved no duplicated assets |
| A09 | Increase fuel price damage road then repair it | New quotes and batches change by formulas indicators respond with delay repair reduces affected cost |
| A10 | Inspect unsafe property procure repairs and pay tax | Reviewable notice authorised budget verified milestone safe tenancy and correct treasury entries |
| A11 | Submit claim investigate deny appeal and pay | Evidence and reasons retained one reserved payment fraudulent allegation remains reviewable |
| A12 | Arrest hear grant bail sentence educate and appeal | Grounds and custody valid scoped evidence capped playable sentence successful appeal restores rights |
| A13 | Forge official role and exceed legal fiscal authority | Commands rejected no money or powers granted valid actions retain audit and oversight |
| A14 | Vote concurrently retry use new account and inspect logs | Eligible vote accepted once ineligible account refused choice not disclosed tally reconciles |
| A15 | Challenge close election recount and certify | Same accepted ballot set reproduces count tribunal authority limited no secret choice exposure |
| A16 | Attempt self reviews fake transactions and collusive ratings | No unverified review eligible service reviewed once risk case records evidence and appeal |
| A17 | Return after long absence with rent loan and needs | Published caps applied no catastrophic survival loss clear offline statement and recovery options |
| A18 | Remove all player providers and absent institution leaders | Essential NPC services run within budgets no NPC ballots acting powers stay bounded |
| A19 | Flood a region dispatch agencies and claim relief twice | Scoped assignments funded treatment and evacuation available relief awarded once repairs connect |
| A20 | Use data saver on weak network and lose connection | Essential actions usable no auto music safe pending state no duplicated money push respects consent |
| A21 | Navigate core flows using keyboard large text and low mode | Accessible controls equivalent outcomes no essential colour or audio only cue adequate measured speed |
| A22 | Open bundle with missing dependency then freeze live contracts | Invalid activation refused valid bundle recorded once existing obligations settled or refunded |
| A23 | Company becomes insolvent and another company acquires it | Creditor rules wages assets licences and shares reconcile no disappearing debt or duplicate ownership |
| A24 | Restore after worker failure and privileged incident | Recovery target met balanced books unique replayed effects protected audit and revoked access |
| A25 | Report harassment voice note official abuse and hacked account | Block effective scoped review no retaliation account recovery logged neutral services remain accessible |
| A26 | Publish campaign petition protest poll and scoped notices | Safe public sharing threshold logged sampling labelled no automatic voter eligibility or spam |
| A27 | Sell final event ticket change DJ track join late and cancel | Capacity exact authorised ordered playback sync spatial sound optional correct refund |
| A28 | Duplicate real callback upload unapproved music and refund | One entitlement unsafe or unauthorised media blocked refund audited no vote or credential gain |
| A29 | Complete sports season fund endowment and retire sponsor | Results verified scholarship funds restricted history retained steward continues institution |
| A30 | Run economy through shock low population and excess graduates | Documented bounds hold essential basket available indicators honest recovery levers funded |
| A31 | Change a requirement and regenerate handoff copies | Stable IDs updated affected tests decisions and release gates linked prior approved version recoverable |

## 12.4 Project memory and version control

The canonical text, requirements register, decision register, acceptance catalogue and release catalogue together form the project's durable memory. The editable Word copy and PDF are published views of the same approved version. New discussions change the source first; regenerated views must carry the same version and date.

Store immutable approved snapshots, a current working version and a change log. Each change identifies author or decision owner, date, reason, affected requirement IDs, previous rule, replacement rule, economic and permission impact, migrations and tests. Never silently rename an ID or remove a feature from scope.

The implementation register extends each R identifier with owner, status, code reference, test evidence, configuration, review date and public bundle. The initial status is Specified. The product owner approves scope or rule changes; domain reviewers verify implementation evidence; operators approve activation readiness under the delegated process.

When handing the project to another session or developer, provide this version, the current registers and the latest change log. The receiving collaborator first checks version and unresolved decisions, then updates the same records. Persisted project files preserve decisions; automatic conversational recall is not the integrity mechanism.

## 12.5 Baseline change log and working glossary

Version 1.0 establishes the system baseline, prelaunch build rule, citizen lifecycle, dependency contracts, economy, authority boundaries, architecture, operations, UX, public activation catalogue, 75 requirements, 26 proposed decisions and 31 acceptance scenarios. Later versions must identify what changed rather than rewriting history.

Citizen means an adult game character with a stable world identity. Account means the authenticated platform user. Household means a consenting group with explicitly shared resources. World means one independent persistent national economy and political timeline. Zone means one authoritative live location process. Instance means a visual population partition sharing the world's durable services.

NPC fallback means a budgeted system operated service used to preserve essential access. Qualification means recorded game education. Licence means current permission for a professional game action. Ledger means balanced durable accounting. Escrow means funds or goods reserved for a contract. Outbox means committed events waiting for delivery. Release bundle means a validated group of capabilities and configuration opened together.

# 13 Technical reference notes

These sources inform technical feasibility and browser constraints. The proposed architecture, performance targets, economic formulas and product rules are design decisions in this bible, not claims made by the sources. Pin versions and revalidate provider behaviour during the technical spike.

1. Three.js documentation, https://threejs.org/docs/ . The main renderer uses locally served pinned engine modules; WebGL capability and performance require device verification. Canvas and DOM fallbacks preserve command access.
2. Supabase Broadcast, https://supabase.com/docs/guides/realtime/broadcast . Reference for realtime control event distribution. Durable transaction correctness remains in the server and database contracts.
3. Supabase Realtime Authorization, https://supabase.com/docs/guides/realtime/authorization . Reference for access control on private Broadcast and Presence channels; policies must match the world's permitted audiences.
4. MDN Using the Web Audio API, https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_Web_Audio_API . Reference for browser audio processing and media source integration; cross origin delivery requires suitable configuration.
5. MDN Autoplay guide, https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay . Reference for playback restrictions and user interaction requirements. Implement a visible sound enable control and a silent usable path.

Reference check date 7 October 2026. This bibliography does not establish music distribution rights, real financial permissions or legal approval for the public service.
