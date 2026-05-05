import { fetchKlanten, createKlant, updateKlant, deleteKlant, Klant } from '../../api';
import ContactenManager from './ContactenManager';

export default function KlantenManager() {
  return (
    <ContactenManager<Klant>
      title="Klanten"
      singular="klant"
      newButtonLabel="+ Nieuwe klant"
      fetchAll={fetchKlanten}
      create={createKlant}
      update={updateKlant}
      remove={deleteKlant}
      showProjectsCount
    />
  );
}
