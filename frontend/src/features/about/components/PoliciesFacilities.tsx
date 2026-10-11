export default function PoliciesFacilities({ policies, facilities }: { policies: string[]; facilities: string[] }) {
  if (!policies.length && !facilities.length) return null;
  return <section className="library-about-chapter" id="about-rules" aria-labelledby="about-rules-title">
    <div className="library-information-kicker">Rules &amp; policies</div>
    <h2 className="library-information-section-title" id="about-rules-title">Library rules and resources</h2>
    {policies.length > 0 && <details className="library-about-details" open><summary>Borrowing guidelines</summary><ol>{policies.map((policy, index) => <li key={index}>{policy}</li>)}</ol></details>}
    {facilities.length > 0 && <details className="library-about-details"><summary>Facilities &amp; resources</summary><ol>{facilities.map((facility, index) => <li key={index}>{facility}</li>)}</ol></details>}
  </section>;
}
