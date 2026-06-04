import { fetchKlanten, createKlant, updateKlant, deleteKlant, refreshKlantLogo, Klant } from '../../api';
import ContactenManager from './ContactenManager';

export default function KlantenManager({ basePath, cardView }: { basePath?: string; cardView?: boolean }) {
  return (
    <ContactenManager<Klant>
      title="Klanten"
      singular="klant"
      newButtonLabel="+ Klant"
      basePath={basePath}
      cardView={cardView}
      fetchAll={fetchKlanten}
      create={createKlant}
      update={updateKlant}
      remove={deleteKlant}
      refreshLogo={refreshKlantLogo}
      showProjectsCount
    />
  );
}
