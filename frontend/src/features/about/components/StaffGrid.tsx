import type { AboutSettings } from "../api/about.service";

const initials = (name: string) => name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("");

export default function StaffGrid({ staff }: { staff: AboutSettings["staff"] }) {
  if (!staff.length) return null;
  const groupFor = (role: string) => /student\s+assistant/i.test(role) ? "Student assistants" : "Library staff";
  const groups = [...new Set(staff.map((member) => groupFor(member.role)))];
  return <section className="library-about-chapter" id="about-staff" aria-labelledby="about-staff-title">
    <div className="library-information-kicker">Library staff</div><h2 className="library-information-section-title" id="about-staff-title">Meet the team</h2>
    {groups.map((group) => <div key={group}><h3 className="library-about-staff-group">{group}</h3>
      <div className="library-about-team">{staff.filter((member) => groupFor(member.role) === group).map((member, index) => <div className="library-about-person" key={member.name + index}>
        {member.image_url ? <img className="library-about-portrait" src={member.image_url} alt={member.image_alt ?? member.name} loading="lazy" /> : <div className="library-about-portrait" aria-hidden="true">{initials(member.name)}</div>}
        <b>{member.name}</b><span>{member.role}</span>
      </div>)}</div>
    </div>)}
  </section>;
}
