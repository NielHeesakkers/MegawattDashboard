import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchBriefing, Activation, Project } from '../api';

interface ScheduleItem {
  time: string;
  wat?: string;
  description?: string; // legacy
  wie?: string;
  bijzonderheden?: string;
}

type BriefingData = Activation & { project: Project };

export default function BriefingPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<BriefingData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetchBriefing(token)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="text-text-secondary">Laden...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Briefing niet gevonden</h1>
          <p className="text-text-secondary">Deze link is ongeldig of verlopen.</p>
        </div>
      </div>
    );
  }

  const project = data.project;
  const klant = project.klant;
  const scheduleItems: ScheduleItem[] = (() => {
    try { return JSON.parse(data.scheduleItems || '[]'); } catch { return []; }
  })();
  const messages: string[] = (() => {
    try { const p = JSON.parse(project.campaignMessage || '[]'); return Array.isArray(p) ? p : [project.campaignMessage]; } catch { return project.campaignMessage ? [project.campaignMessage] : []; }
  })();
  const clothing: { megawatt: string[]; self: string[]; info: string } = (() => {
    try { const p = JSON.parse(project.clothing || '{}'); return { megawatt: p.megawatt || [], self: p.self || [], info: p.info || '' }; } catch { return { megawatt: project.clothing ? [project.clothing] : [], self: [], info: '' }; }
  })();
  const hasClothing = clothing.megawatt.length > 0 || clothing.self.length > 0 || clothing.info;
  const stores = data.storeList?.split('\n').filter(Boolean) || [];
  const seniors = data.staff?.filter((s) => s.role === 'senior') || [];
  const superchargers = data.staff?.filter((s) => s.role === 'supercharger') || [];

  const formatDate = (d: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-bg-main">
      {/* Header */}
      <div className="bg-bg-surface border-b border-[rgba(255,255,255,0.08)]">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-3">
            {klant?.logo && (
              <div className="w-12 h-12 rounded-full overflow-hidden bg-white shrink-0">
                <img src={klant.logo} alt="" className="w-full h-full object-contain p-1" />
              </div>
            )}
            <div>
              <div className="text-text-secondary text-sm">{klant?.name}</div>
              <h1 className="text-2xl font-bold text-text-primary">{project.name || project.projectNumber}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-text-secondary">
            <span>{data.location}</span>
            {data.date && <span>{formatDate(data.date)}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* 01 - Campagne */}
        {(project.campaignDescription || messages.length > 0 || project.campaignTargetAudience) && (
          <Section number="01" title="De campagne">
            {project.campaignDescription && (
              <div className="mb-4">
                <Label>Campagne omschrijving</Label>
                <p className="text-text-primary whitespace-pre-wrap">{project.campaignDescription}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {messages.length > 0 && (
                <div>
                  <Label>Boodschap</Label>
                  <ul className="space-y-1">
                    {messages.map((msg, i) => (
                      <li key={i} className="text-text-primary text-sm">&lsquo;{msg}&rsquo;</li>
                    ))}
                  </ul>
                </div>
              )}
              {project.campaignTargetAudience && (
                <div>
                  <Label>Doelgroep</Label>
                  <p className="text-text-primary whitespace-pre-wrap">{project.campaignTargetAudience}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* 02 - De activatie */}
        <Section number="02" title="De activatie">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label>Locatie</Label>
              <p className="text-text-primary">{data.location}</p>
            </div>
            <div>
              <Label>Datum</Label>
              <p className="text-text-primary">{formatDate(data.date)}</p>
            </div>
            {data.startTime && (
              <div>
                <Label>Starttijd</Label>
                <p className="text-text-primary">{data.startTime}</p>
              </div>
            )}
            {data.endTime && (
              <div>
                <Label>Eindtijd</Label>
                <p className="text-text-primary">{data.endTime}</p>
              </div>
            )}
          </div>

          {data.target && (
            <div className="mb-4">
              <Label>Target</Label>
              <p className="text-text-primary whitespace-pre-wrap">{data.target}</p>
            </div>
          )}

          {data.tasks && (
            <div className="mb-4">
              <Label>Werkzaamheden</Label>
              <p className="text-text-primary whitespace-pre-wrap">{data.tasks}</p>
            </div>
          )}

          {scheduleItems.length > 0 && (
            <div>
              <Label>Dagindeling</Label>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.15)]">
                      <th className="text-left text-accent-teal text-xs font-bold uppercase tracking-wider py-2 pr-3 w-28">Tijd</th>
                      <th className="text-left text-accent-teal text-xs font-bold uppercase tracking-wider py-2 px-3">Wat</th>
                      <th className="text-left text-accent-teal text-xs font-bold uppercase tracking-wider py-2 px-3 w-36">Wie</th>
                      <th className="text-left text-accent-teal text-xs font-bold uppercase tracking-wider py-2 pl-3">Bijzonderheden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleItems.map((item, i) => (
                      <tr key={i} className="border-b border-[rgba(255,255,255,0.06)]">
                        <td className="text-accent-teal font-mono text-sm py-2 pr-3">{item.time}</td>
                        <td className="text-text-primary text-sm py-2 px-3">{item.wat || item.description}</td>
                        <td className="text-text-primary text-sm py-2 px-3">{item.wie}</td>
                        <td className="text-text-secondary text-sm py-2 pl-3">{item.bijzonderheden}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Section>

        {/* 03 - Kleding & Setting */}
        {(hasClothing || project.settingInstructions) && (
          <Section number="03" title="Kleding en setting">
            {hasClothing && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {clothing.megawatt.length > 0 && (
                  <div>
                    <Label>Megawatt</Label>
                    <ul className="space-y-0.5">
                      {clothing.megawatt.map((item, i) => (
                        <li key={i} className="text-text-primary text-sm">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {clothing.self.length > 0 && (
                  <div>
                    <Label>Zelf meenemen</Label>
                    <ul className="space-y-0.5">
                      {clothing.self.map((item, i) => (
                        <li key={i} className="text-text-primary text-sm">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {clothing.info && (
                  <div className="sm:col-span-2">
                    <Label>Info</Label>
                    <p className="text-text-primary whitespace-pre-wrap">{clothing.info}</p>
                  </div>
                )}
              </div>
            )}
            {project.settingInstructions && (
              <div>
                <Label>Setting & veiligheid</Label>
                <p className="text-text-primary whitespace-pre-wrap">{project.settingInstructions}</p>
              </div>
            )}
          </Section>
        )}

        {/* 04 - Team */}
        {(seniors.length > 0 || superchargers.length > 0) && (
          <Section number="04" title="Het team">
            {seniors.length > 0 && (
              <div className="mb-4">
                <Label>Seniors</Label>
                <div className="flex flex-wrap gap-3 mt-2">
                  {seniors.map((s) => (
                    <StaffCard key={s.id} name={`${s.supercharger.firstName} ${s.supercharger.lastName}`} photo={s.supercharger.photo} role="Senior" />
                  ))}
                </div>
              </div>
            )}
            {superchargers.length > 0 && (
              <div>
                <Label>Superchargers</Label>
                <div className="flex flex-wrap gap-3 mt-2">
                  {superchargers.map((s) => (
                    <StaffCard key={s.id} name={`${s.supercharger.firstName} ${s.supercharger.lastName}`} photo={s.supercharger.photo} role="Supercharger" />
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* 05 - Extra informatie */}
        {(data.extraInfo || data.photoRequirements || data.evaluationLink) && (
          <Section number="05" title="Extra informatie">
            {data.extraInfo && (
              <div className="mb-4">
                <p className="text-text-primary whitespace-pre-wrap">{data.extraInfo}</p>
              </div>
            )}
            {data.photoRequirements && (
              <div className="mb-4">
                <Label>Actiefoto eisen</Label>
                <p className="text-text-primary whitespace-pre-wrap">{data.photoRequirements}</p>
              </div>
            )}
            {data.evaluationLink && (
              <div>
                <Label>Evaluatielink</Label>
                <a href={data.evaluationLink} target="_blank" rel="noopener noreferrer" className="text-accent-teal hover:opacity-80 underline break-all">
                  {data.evaluationLink}
                </a>
              </div>
            )}
          </Section>
        )}

        {/* 06 - Winkellijst */}
        {stores.length > 0 && (
          <Section number="06" title="Winkellijst">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
              {stores.map((store, i) => (
                <span key={i} className="text-text-primary text-sm">{store}</span>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-accent-teal font-bold text-lg">{number}</span>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-text-secondary text-sm mb-1">{children}</div>;
}

function StaffCard({ name, photo, role }: { name: string; photo: string | null; role: string }) {
  return (
    <div className="flex items-center gap-3 bg-[rgba(255,255,255,0.04)] rounded-lg px-3 py-2">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-bg-surface shrink-0">
        {photo ? (
          <img src={photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-secondary text-sm font-medium">
            {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
        )}
      </div>
      <div>
        <div className="text-text-primary text-sm font-medium">{name}</div>
        <div className="text-text-secondary text-xs">{role}</div>
      </div>
    </div>
  );
}
