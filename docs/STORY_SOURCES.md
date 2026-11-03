# Story sources

This is the fact base for _The Thirteenth Hand_. Each claim the story makes, or
may make, about real places, people, law or art is listed with:

- the exact source URL;
- its publisher;
- the scene it serves;
- how far it was checked.

Three kinds of material are kept apart:

1. **History**: documented fact. Only this goes into `kind: 'history'`
   field notes, and every such note carries a source.
2. **Interpretation**: a reasonable reading of the record, a character's
   opinion, or framing. It may be spoken by a character, but never shown as a
   history note.
3. **Invented lore**: the story's own fiction. Location `fiction` notes and
   `note` cards say so plainly.

**Status key**

- **Read**: the source page or statute text was opened and the claim
  matched.
- **Search-confirmed**: the publisher's page was located and its text
  matched in search results, but automated fetching was blocked or came back
  empty. Open the URL by hand before quoting exact wording.
- **Not yet checked**: an existing claim this pass did not research. It needs
  a check before it is expanded or rewritten.

Research date: 2026-11-03. The game's notes are short paraphrases: quote
exact wording only from a page marked Read.

## 1. Public records, FOIA and filming: corrected

**The correction.** The location note for Jak's parlor (Chapter 4) said:

> "Anyone may request public records from Virginia public bodies under the
> Virginia Freedom of Information Act…"

This was wrong. The Virginia Act gives its right of access to **citizens of the
Commonwealth** and to representatives of media circulating or broadcasting in
Virginia, not to anyone. The note is now split into two accurate notes:

- "Public records in Virginia";
- "Filming in public".

The Chapter 4 field note `foia-1966` was also clarified. It explained Jak's
black bars with the _federal_ Act's nine exemptions, but Jak asked _the city_,
and a Virginia city answers under the state's own Act.
`tests/unit/storySources.test.ts` keeps both corrections in place.

**Three different things, not to be blended:**

| Topic                                                | What it covers                                                                             | Who may use it                                                                                                                                         | Key limits                                                                                                                                        | Story use                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Virginia FOIA** (Code of Virginia §§ 2.2-3700 ff.) | Records of Virginia state and local public bodies, including a city such as Fredericksburg | Citizens of the Commonwealth; reps of newspapers and magazines circulating in Virginia; reps of radio and TV stations broadcasting in or into Virginia | The custodian may ask for name and legal address; reply within 5 working days; reasonable charges allowed; the Act has its own exclusions         | Jak's request "to the city about the old cellars" (Ch. 4) is a Virginia FOIA request. Jak is a local, so he qualifies |
| **Federal FOIA** (5 U.S.C. § 552)                    | Records of federal executive-branch agencies                                               | Generally any person, U.S. citizen or not                                                                                                              | Nine exemptions                                                                                                                                   | The `foia-1966` field note; anything Jak asks of a federal agency                                                     |
| **Filming in public**                                | Recording what happens in public places                                                    | A First Amendment question, not a records right                                                                                                        | Narrower in non-public forums (private offices, many government interiors) and on private property; Virginia audio recording is one-party consent | Jak's camera, "lawfully filming", the River Station lobby scene, "filming in a public place you happen to be in"      |

| #   | Claim                                                                                                                                                                                                                                                          | Kind                 | Source URL                                                                                                               | Publisher                                                                                            | Scene                                                                                 | Status                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | Virginia public records "shall be open to citizens of the Commonwealth", reps of newspapers and magazines with circulation in the Commonwealth, and reps of radio and TV stations broadcasting in or into it. The custodian may require name and legal address | History              | https://law.lis.virginia.gov/vacode/title2.2/chapter37/section2.2-3704/                                                  | Virginia General Assembly (Legislative Information System), Code of Virginia § 2.2-3704(A)           | Location note "Public records in Virginia" (Jak's parlor, Ch. 4)                      | Read                                                                                                                                       |
| F2  | A public body must respond within five working days; it may charge reasonable costs of accessing, duplicating, supplying or searching                                                                                                                          | History              | https://law.lis.virginia.gov/vacode/title2.2/chapter37/section2.2-3704/                                                  | Code of Virginia § 2.2-3704(B), (F)                                                                  | Background for Jak's "First, nothing. Then a reply…" (4-1)                            | Read                                                                                                                                       |
| F3  | The FOIA Council's own guide lists the same requesters, says a public body may require name and legal address before processing, and counts the day after receipt as day 1                                                                                     | History              | https://foiacouncil.dls.virginia.gov/ref/Access%20to%20Public%20Records%202026%20DOCUMENT.html                           | Virginia Freedom of Information Advisory Council, _Access to Public Records_ (2026)                  | Same note; the guidance to follow if Jak's process is ever dramatized                 | Read                                                                                                                                       |
| F4  | The Council also publishes best-practice guidance for making requests (2026 update)                                                                                                                                                                            | History              | https://foiacouncil.dls.virginia.gov/ref/Best%20Practices%20for%20Making%20Requests%20for%20Public%20Records%202026.docx | Virginia Freedom of Information Advisory Council                                                     | Writer reference for Ch. 4                                                            | Search-confirmed (the Council site answered 503 or 404 to some requests during this check; its 2023 citizen-guide PDF URL now returns 404) |
| F5  | The U.S. Supreme Court upheld Virginia's citizens-only access rule against Privileges and Immunities and dormant Commerce Clause challenges                                                                                                                    | History              | https://supreme.justia.com/cases/federal/us/569/221/                                                                     | _McBurney v. Young_, 569 U.S. 221 (2013), via Justia; official text at supremecourt.gov              | Writer reference: why "anyone" was wrong                                              | Search-confirmed                                                                                                                           |
| F6  | "Generally any person — United States citizen or not — can make a FOIA request"; nine exemptions                                                                                                                                                               | History              | https://www.foia.gov/faq.html                                                                                            | U.S. Department of Justice, FOIA.gov                                                                 | Field note `foia-1966` (4-3); "Public records in Virginia" (federal half)             | Read                                                                                                                                       |
| F7  | The federal FOIA became law in 1966                                                                                                                                                                                                                            | History              | https://www.foia.gov/about.html                                                                                          | U.S. Department of Justice, FOIA.gov                                                                 | Field note `foia-1966`                                                                | Not yet checked (well known; confirm on the page)                                                                                          |
| F8  | Livestreaming a police traffic stop is speech protected by the First Amendment (Fourth Circuit, which includes Virginia; decided 7 Feb 2023)                                                                                                                   | History              | https://www.ca4.uscourts.gov/opinions/211827.p.pdf                                                                       | U.S. Court of Appeals for the Fourth Circuit, _Sharpe v. Winterville Police Department_, No. 21-1827 | Location note "Filming in public"                                                     | Read (caption, date and court read from the opinion; the holding from the court's summary in search results)                               |
| F9  | "First Amendment audits" film officials in public places; there is no reasonable expectation of privacy against filming in public; non-public forums and private property are different, and filming there may be trespass                                     | History / definition | https://firstamendment.mtsu.edu/article/first-amendment-audits/                                                          | The First Amendment Encyclopedia, Middle Tennessee State University (John R. Vile)                   | Jak's role ("First Amendment auditor"); location note "Filming in public"             | Read                                                                                                                                       |
| F10 | Virginia audio recording is one-party consent: no crime if the recorder is a party, or one party consented                                                                                                                                                     | History              | https://law.lis.virginia.gov/vacode/title19.2/chapter6/section19.2-62/                                                   | Code of Virginia § 19.2-62(B)(2)                                                                     | Writer guardrail: Jak records conversations he is part of, never others' private talk | Search-confirmed (secondary summaries; open the statute before quoting)                                                                    |

**Interpretation, Ch. 4:**

- "They redacted everything except the name. Either somebody was sloppy, or
  somebody wanted it read." This is Jak's reading, not a claim about any real
  record.
- Calling a records reply "almost all black bars" is fair dramatization:
  redaction is how withheld portions are commonly shown. It is not a claim
  about what the City of Fredericksburg actually withholds.

**Invented, Ch. 4:** the request, the reply, "Operation Thirteenth Hand", Jak's
parlor, and the ban from the stairwell.

**Writing guardrails that follow from this:**

- Jak cites the right regime: Virginia FOIA for the city, federal FOIA for a
  federal agency, the First Amendment for his camera. He does not claim FOIA
  lets him film anywhere, or that filming lets him into non-public rooms.
- Jak never secretly records a conversation he isn't part of.
- Any line about rights stays correct as law. A character may be wrong only
  if another character or a note corrects them.

## 2. The river and the port

| #   | Claim                                                                                                                                                                                                                                                                                        | Kind           | Source URL                                                        | Publisher                                                                                  | Scene                                                                                              | Status                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| R1  | Fredericksburg's historic district includes "the original fifty-acre town site of 1728"; the city "was originally a frontier port at the falls of the Rappahannock, serving settlers to the west" and "grew as a trading center and the Spotsylvania County seat during the colonial period" | History        | https://www.dhr.virginia.gov/historic-registers/111-0132/         | Virginia Department of Historic Resources, Fredericksburg Historic District (VLR 111-0132) | Field notes `fredericksburg-1728` (Ch. 1), `fall-line` (Ch. 2); the location note "Fredericksburg" | Read                                                                                                             |
| R2  | The city was established by an act of the Virginia General Assembly in 1728 on land along the Rappahannock                                                                                                                                                                                   | History        | https://va-fredericksburg.civicplus.com/1372/About-Fredericksburg | City of Fredericksburg, "About Fredericksburg"                                             | Same notes; the existing source line "City of Fredericksburg" can point here                       | Search-confirmed                                                                                                 |
| R3  | Vessels from the Chesapeake Bay tied up at the town's docks; tobacco (and iron) were loaded there in the colonial period                                                                                                                                                                     | History        | https://www.hmdb.org/m.asp?m=14422                                | Historical Marker Database, transcribing a Virginia historical marker                      | Colour for the "old waterfront" (Chs. 5, 7, 8)                                                     | Search-confirmed (marker text via search; HMDB blocked automated fetch). Prefer R1 for anything shown as history |
| R4  | Sources disagree on the town's incorporation date (1781 or 1782)                                                                                                                                                                                                                             | Writer caution | (secondary sources)                                               | n/a                                                                                        | Do not state an incorporation year in game text                                                    | Note only                                                                                                        |

**Interpretation:**

- "The old waterfront" as the place where the story's marks cluster: the
  river port was the town's reason to exist, so the colonial wharves are a
  fair setting.
- Steve's "read downstream from the north" is an in-story reading of
  invented marks.

**Invented:**

- the River Station and its staff;
- the trail-marker club;
- the cellar door on the waterfront;
- the tunnels under the old town, which a location note already says are not
  documented history.

## 3. Living Rappahannock history

| #   | Claim                                                                                                                                                                                                                                      | Kind    | Source URL                                                                                                       | Publisher                                              | Scene                                                                                                             | Status                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| T1  | The Rappahannock Tribe was federally recognized by the Thomasina E. Jordan Indian Tribes of Virginia Federal Recognition Act of 2017 (H.R. 984), Public Law 115-121, signed 29 Jan 2018, with five other Virginia tribes                   | History | https://www.govinfo.gov/link/plaw/115/public/121                                                                 | U.S. Government Publishing Office (Public Law 115-121) | Field note `rappahannock-name`; the location note "The river's name" (Ch. 2)                                      | Search-confirmed                                    |
| T2  | On 1 April 2022 the Tribe reacquired 465 acres at Fones Cliffs, a sacred site on the river's eastern bank. The cliffs rise over 100 ft. Pissacoack (spelled "Pissacoak" by Interior) was one of three Tribal villages there before contact | History | https://doi.gov/pressreleases/secretary-haaland-celebrates-rappahannock-tribes-reacquisition-ancestral-homelands | U.S. Department of the Interior                        | A possible present-day line for Sophia (Ch. 2 or the epilogue): the river's history is ongoing, not only colonial | Read                                                |
| T3  | The Tribe's _Return to the River_ program trains Tribal youth in traditional river knowledge and practices, and offers outreach to other communities interested in the river                                                               | History | https://doi.gov/pressreleases/secretary-haaland-celebrates-rappahannock-tribes-reacquisition-ancestral-homelands | U.S. Department of the Interior                        | Same                                                                                                              | Read                                                |
| T4  | A later transfer (land bought by The Conservation Fund in December 2022) returned nearly 1,000 more acres at Fones Cliffs                                                                                                                  | History | https://fws.gov/story/2025-09/restoring-tribal-stewardship                                                       | U.S. Fish and Wildlife Service                         | Same; check the final acreage on the page before using a number                                                   | Search-confirmed                                    |
| T5  | The Tribe's own account of its history and programs                                                                                                                                                                                        | History | https://www.rappahannocktribe.org/                                                                               | Rappahannock Tribe                                     | The source to prefer for any line about the Tribe                                                                 | Not yet checked: read before writing Tribal content |

**Guardrails:**

- The Rappahannock Tribe is a living nation, not a backdrop.
- The story invents no Tribal lore, ceremonies or spiritual content. The
  existing Eastern Woodlands deck note already says the deck is a visual theme
  and that the clues don't represent Native traditions.
- Any new Tribal content is factual, sourced to the Tribe or the federal
  agencies above, and present-tense where the program is current.
- Sophia's background (cast note: "a Native American ranger") is not
  specified as Rappahannock. Don't add a tribal affiliation without the
  owner's direction.

## 4. Kenmore, Mary Ball Washington, and Washington in Fredericksburg

| #   | Claim                                                                                                                                                                                                                                                                                    | Kind    | Source URL                                                                                 | Publisher                                                | Scene                                                                                            | Status                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| K1  | Kenmore was built by Fielding Lewis and Betty Washington Lewis (George Washington's sister); construction began in 1769, and the family moved in in fall 1775                                                                                                                            | History | https://kenmore.org/wp-content/uploads/2022/12/12a-Key-Facts-Page-for-Media-Rev-Dec-22.pdf | The George Washington Foundation, "Key Facts" (Dec 2022) | Location note "Kenmore", **corrected** from "built in the 1770s" to "from 1769 to 1775"          | Read                                                                                                           |
| K2  | Kenmore is noted for 18th-century decorative plasterwork ceilings by a craftsman known only as "The Stucco Man"                                                                                                                                                                          | History | (same PDF)                                                                                 | The George Washington Foundation                         | 7-1 "Plaster Ceilings"                                                                           | Read                                                                                                           |
| K3  | Fielding died in 1781 and the property went to his son John; Betty remained another 14 years. The name "Kenmore" was first used by Samuel Gordon (bought 1819). The house took cannon hits in 1862 and was a field hospital in 1864. It has been a National Historic Landmark since 1970 | History | (same PDF)                                                                                 | The George Washington Foundation                         | Optional Ch. 7 colour. Note that the Lewises didn't call it "Kenmore": Mary's ghost might, wryly | Read                                                                                                           |
| K4  | Fielding Lewis grew corn and wheat and was not a major tobacco producer                                                                                                                                                                                                                  | History | (same PDF)                                                                                 | The George Washington Foundation                         | Avoid writing Kenmore as a tobacco estate                                                        | Read                                                                                                           |
| K5  | The Washingtons moved to Ferry Farm (which they called "Home Farm") in 1738, when George was 6; they did not own the ferry                                                                                                                                                               | History | (same PDF)                                                                                 | The George Washington Foundation                         | Location note "Ferry Farm" (Ch. 2); Mary's lines about George's boyhood                          | Read                                                                                                           |
| K6  | George Washington bought the Charles Street house for his mother in 1772, near Betty's home. Mary is believed buried near Meditation Rock; the obelisk dates from 1894                                                                                                                   | History | https://www.washingtonheritagemuseums.org/museum-details                                   | Washington Heritage Museums (Mary Washington House)      | Location note "Mary Ball Washington"; field note `meditation-rock` (Ch. 7)                       | Search-confirmed                                                                                               |
| K7  | The Fredericksburg Gun Manufactory was set up in 1775 under Fielding Lewis and Charles Dick, chronically underfunded, and largely repaired arms                                                                                                                                          | History | https://encyclopediavirginia.org/entries/lewis-fielding-1725-1781-or-1782/                 | Virginia Humanities, _Encyclopedia Virginia_             | Field note `fredericksburg-gunnery` (Ch. 7)                                                      | Search-confirmed (sources differ on the founding ordinance date: 17 July or 26 Aug 1775, so don't state a day) |
| K8  | Enslaved people lived and worked at Kenmore and Ferry Farm                                                                                                                                                                                                                               | History | https://kenmore.org/                                                                       | The George Washington Foundation                         | Not yet in the game. If the Kenmore chapter is deepened, acknowledge it plainly, never as comedy | Not yet checked: read the Foundation's interpretation before writing                                           |

**Interpretation:**

- Mary as "not impressed by her son": a characterization. Historians describe
  a strained, practical relationship, but the ghost's opinions are the
  story's.
- George as proud, competitive, and bad at losing: comic characterization.
  Washington's account books do record his card winnings and losses (field
  note `washington-cards`, not yet re-checked).

**Invented:**

- both ghosts;
- the twelve hands played in Mary's parlor;
- Mary's letter and the iron key;
- the unfinished game;
- the spectral parlor.

## 5. Washington and Fredericksburg Lodge No. 4

| #   | Claim                                                                                                                                                                                                     | Kind    | Source URL                                                                                                | Publisher                                                                                 | Scene                                                                                                               | Status                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| L1  | Washington was initiated an Entered Apprentice in the Lodge at Fredericksburg on 4 Nov 1752 (Old Style date, as in the minutes), passed Fellow Craft on 3 Mar 1753, and raised Master Mason on 4 Aug 1753 | History | https://www.mountvernon.org/digital-encyclopedia/article/freemasonry                                      | George Washington's Mount Vernon (Mount Vernon Ladies' Association), Digital Encyclopedia | Location note "Washington's initiation"; Ch. 6                                                                      | Search-confirmed (403 to automated fetch)                                              |
| L2  | The same, from a Masonic museum                                                                                                                                                                           | History | https://gwmemorial.org/blogs/library-collections/george-washington-raised-a-master-mason                  | George Washington Masonic National Memorial                                               | Ch. 6                                                                                                               | Search-confirmed                                                                       |
| L3  | The lodge still meets in Fredericksburg (803 Princess Anne St.) and shows the Bible on which Washington took his obligation                                                                               | History | https://fxbg.com/attraction/fredericksburg-masonic-lodge-no-4/                                            | Fredericksburg Economic Development & Tourism                                             | Location description (Ch. 6)                                                                                        | Search-confirmed. The lodge's own site, https://masoniclodge4.org/, is not yet checked |
| L4  | Washington laid the U.S. Capitol's first cornerstone in a Masonic ceremony, 18 Sep 1793; its exact location and silver plate have not been confirmed since                                                | History | https://www.aoc.gov/explore-capitol-campus/art/first-cornerstone                                          | Architect of the Capitol                                                                  | Field note `capitol-cornerstone` (6-1)                                                                              | Search-confirmed                                                                       |
| L5  | The Culper Ring, organized by Benjamin Tallmadge in 1778, reported on the British in New York and used a code book                                                                                        | History | https://mountvernon.org/george-washington/the-revolutionary-war/spying-and-espionage/the-culper-code-book | George Washington's Mount Vernon                                                          | Location note "Washington's spies" (invisible ink and dead drops are part of the note: check them on the same site) | Search-confirmed                                                                       |

**Interpretation:** Steve "separates documented history from legend". The
lodge chapter's job is to model that habit, without debunking for comedy and
without reverence for its own sake.

**Invented:**

- the cipher on the card;
- the lodge's part in the mystery;
- any "secret card ceremony".

The location note already says no secret card ceremony is a real Masonic
practice. Never depict real ritual, passwords or degree work.

## 6. Public Masonic symbolism

| #   | Claim                                                                                                                                                                                                                                                                                                                                   | Kind                                                          | Source URL                                                                                                                                                                              | Publisher                                   | Scene                                                                                | Status                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | The square and compasses are Freemasonry's best-known public emblem, drawn from builders' tools and used to teach moral lessons (the square for virtue or honesty, the compasses for self-restraint). The emblem is displayed openly: the George Washington Masonic National Memorial set a 4,000 sq ft one into its front lawn in 1999 | Interpretation (as Masonic organizations publicly explain it) | https://gwmemorial.org/pages/history                                                                                                                                                    | George Washington Masonic National Memorial | Ch. 6 title "Square and Compasses"; Steve's diagram ("Not Masonic. Borrowed tools.") | Search-confirmed (the memorial's history page). Readings of the emblem vary between jurisdictions, so present them as "Masons often explain…", not fixed doctrine |
| M2  | The "pigpen" cipher is often called the Masonic or Freemasons' cipher. Freemasons used it in the 18th century, but its origin date is uncertain                                                                                                                                                                                         | History (with uncertainty)                                    | **None found.** The game's source line names the Scottish Rite Masonic Museum & Library, but no page of theirs on the cipher was found; search hits were reference and enthusiast sites | (to find)                                   | Field note `pigpen-cipher` (6-4)                                                     | Not yet checked: soften to "often called…" or find a museum or library citation                                                                                   |
| M3  | The Shriners (red fez) are a separate organization of Masons; their hospitals date from 1922                                                                                                                                                                                                                                            | History                                                       | https://www.shrinerschildrens.org/en/about-us                                                                                                                                           | Shriners Children's                         | Field note `shriners` (6-2); Dante's "little red hats" gag (3-4)                     | Not yet checked                                                                                                                                                   |

**Guardrails:**

- Use only symbols Masons themselves display publicly.
- Frame meanings as Masons' own explanations.
- Never depict ritual, grip, password or oath content.
- Don't imply conspiracy or real-world covert power. The story's "secret" is
  a ghost's card game.

## 7. Psychedelic poster culture

| #   | Claim                                                                                                                                                                                                                                                                               | Kind                  | Source URL                                                                                         | Publisher                                                                | Scene                              | Status                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Daylight-fluorescent ("Day-Glo") pigments came from the Switzer brothers' work beginning in the 1930s. The company was founded as Switzer Brothers, Inc. in 1946 and renamed Day-Glo Color Corp. in 1969. The ACS designated it a National Historic Chemical Landmark on 8 Sep 2012 | History               | https://www.acs.org/education/whatischemistry/landmarks/dayglo.html                                | American Chemical Society                                                | Field note `day-glo` (3-1)         | Search-confirmed (the page came back empty to automated fetch). The note says the brothers "went on to found the Day-Glo company": acceptable, but the founding name was Switzer Brothers         |
| P2  | Mid-1960s San Francisco concert posters, notably Wes Wilson's for Bill Graham's Fillmore shows, used dense, flowing hand lettering that you had to slow down to read                                                                                                                | History / art history | https://www.famsf.org/artworks/new-generation-jay-walkers-charlatans-may-13-14-fillmore-auditorium | Fine Arts Museums of San Francisco (collection record, Wes Wilson, 1966) | Field note `concert-posters` (3-2) | Search-confirmed (record exists; "hard to read on purpose" is the common art-historical reading, so keep it as "used… lettering you had to stare at")                                             |
| P3  | Wilson designed the Family Dog's early posters and logo before concentrating on Graham's series                                                                                                                                                                                     | History               | https://www.gdao.org/exhibits/show/posters/wes-wilson                                              | Grateful Dead Archive Online (UC Santa Cruz Library)                     | Optional Dante line                | Search-confirmed                                                                                                                                                                                  |
| P4  | "Psychonaut" was coined by Ernst Jünger                                                                                                                                                                                                                                             | History               | n/a                                                                                                | n/a                                                                      | Dante's line (3-4)                 | **Not yet checked**: needs a published source (Jünger's _Annäherungen_, 1970, is the usual citation). Until then, cut the attribution or keep it in Dante's voice ("some German writer used it…") |

**Guardrails:**

- Dante's chapter stays about art and graphic history: colour, lettering,
  blacklight.
- No drug content and no products. The adult-rated iSMOKESHOP boards stay
  gated and unused.

## 8. Existing field notes this pass did not check

These stay as they are, but need a check before being expanded or quoted:

| Field note                                     | Chapter | Current source line                                               |
| ---------------------------------------------- | ------- | ----------------------------------------------------------------- |
| `great-blue-heron`                             | 2       | Cornell Lab of Ornithology, All About Birds                       |
| `american-shad`                                | 2       | Friends of the Rappahannock; U.S. Fish and Wildlife Service       |
| `bald-eagle`                                   | 2       | Center for Conservation Biology, William & Mary                   |
| `hollow-nickel`                                | 5       | FBI, "Hollow Nickel/Rudolph Abel"                                 |
| `map-decks`                                    | 5       | The National WWII Museum                                          |
| `ace-of-spades-duty`                           | 5       | The British Museum; Worshipful Company of Makers of Playing Cards |
| `norwich`                                      | 6       | Norwich University                                                |
| `washington-cards`                             | 7       | George Washington's Mount Vernon                                  |
| `new-deck-order`                               | 8       | United States Playing Card Company (Bicycle)                      |
| `crossing-the-delaware`, `long-island-retreat` | 9       | George Washington's Mount Vernon                                  |
| `valley-forge`                                 | 9       | National Park Service                                             |

## 9. Invented lore: the full list

Nothing below is history, and nothing below may appear in a `history` note:

- **Objects and the legend:** the Thirteenth Hand card; Lot 13; the ledger of
  twelve hands; the unfinished thirteenth game.
- **Places:** Cheryl's shop; the River Station; iSMOKESHOP's art counter;
  Jak's parlor; Mrs. Gray's safehouse.
- **Plot:** Operation Thirteenth Hand (fiction, not a real program); the
  redacted reply; the four suit marks; the cipher; the tunnels and the
  four-suit door; the iron key; Mary's letter.
- **Ghosts:** both ghosts, and the spectral parlor.
- **"G. W." the client:** the commission, the card cases, the payment in
  ones.

Jak Gold and Steve Gonzales are fictionalized portrayals of real people. The
story gives them no real criminal or covert conduct (`src/story/cast.ts`).
