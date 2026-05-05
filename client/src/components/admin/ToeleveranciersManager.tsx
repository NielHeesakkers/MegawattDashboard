import {
  fetchToeleveranciers, createToeleverancier, updateToeleverancier, deleteToeleverancier,
  Toeleverancier,
} from '../../api';
import ContactenManager from './ContactenManager';

export default function ToeleveranciersManager() {
  return (
    <ContactenManager<Toeleverancier>
      title="Toeleveranciers"
      singular="toeleverancier"
      newButtonLabel="+ Nieuwe toeleverancier"
      fetchAll={fetchToeleveranciers}
      create={createToeleverancier}
      update={updateToeleverancier}
      remove={deleteToeleverancier}
    />
  );
}
