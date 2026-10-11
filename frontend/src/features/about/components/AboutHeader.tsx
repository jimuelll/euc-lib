export default function AboutHeader({ libraryName }: { libraryName: string }) {
  return <header className="library-information-heading"><div className="library-information-kicker">EUC Library</div><h1>About the library</h1><p>Our history, mission, staff and facilities, everything you need to know about {libraryName}.</p></header>;
}
