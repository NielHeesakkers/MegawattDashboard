import { useState, useEffect } from 'react';
import { fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, AdminUser } from '../../api';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import Modal from '../ui/Modal';

export default function UserManager() {
  const { username: currentUsername } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [editingUser, setEditingUser] = useState<{ id?: number; username: string; password: string } | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const data = await fetchAdminUsers();
    setUsers(data);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editingUser?.username || saving) return;
    if (isCreating && !editingUser.password) {
      setError('Wachtwoord is verplicht');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingUser.id) {
        const data: { username?: string; password?: string } = { username: editingUser.username };
        if (editingUser.password) data.password = editingUser.password;
        await updateAdminUser(editingUser.id, data);
      } else {
        await createAdminUser({ username: editingUser.username, password: editingUser.password });
      }
      setEditingUser(null);
      setIsCreating(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Opslaan mislukt';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      await deleteAdminUser(deletingUser.id);
      setDeletingUser(null);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Verwijderen mislukt';
      setError(msg);
      setDeletingUser(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Gebruikers</h1>
        <button
          onClick={() => { setEditingUser({ username: '', password: '' }); setIsCreating(true); setError(''); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[8px] bg-accent text-bg-dark font-semibold text-sm hover:brightness-110 transition-all duration-150 shadow-[0_2px_8px_rgba(201,168,76,0.3)] cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Gebruiker toevoegen
        </button>
      </div>

      {error && !editingUser && (
        <p className="text-danger text-sm mb-4 bg-danger/10 px-4 py-2 rounded-lg">{error}</p>
      )}

      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            onClick={() => { setEditingUser({ id: user.id, username: user.username, password: '' }); setIsCreating(false); setError(''); }}
            className="flex items-center gap-3 bg-bg-card p-3 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-accent-teal/20 flex items-center justify-center text-accent-teal text-sm font-bold flex-shrink-0">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 text-text-primary font-medium">{user.username}</span>
            {user.username === currentUsername && (
              <span className="text-accent-teal text-xs bg-accent-teal/10 px-2 py-0.5 rounded-full">Jij</span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setDeletingUser(user); setError(''); }}
              className="text-red-400 text-sm hover:underline"
              disabled={user.username === currentUsername}
              title={user.username === currentUsername ? 'Je kunt jezelf niet verwijderen' : ''}
            >
              Verwijderen
            </button>
          </div>
        ))}
      </div>

      {/* Edit / Create modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => { setEditingUser(null); setIsCreating(false); setError(''); }}
        title={isCreating ? 'Nieuwe gebruiker' : 'Gebruiker bewerken'}
      >
        {editingUser && (
          <div className="space-y-4">
            {error && (
              <p className="text-danger text-sm bg-danger/10 px-4 py-2 rounded-lg">{error}</p>
            )}
            <div>
              <label className="block text-text-secondary text-sm mb-1">Gebruikersnaam</label>
              <input
                type="text"
                value={editingUser.username}
                onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
              />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">
                {isCreating ? 'Wachtwoord' : 'Nieuw wachtwoord (laat leeg om niet te wijzigen)'}
              </label>
              <input
                type="password"
                value={editingUser.password}
                onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
                placeholder={isCreating ? '' : 'Ongewijzigd'}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setEditingUser(null); setIsCreating(false); setError(''); }}
                className="px-4 py-2 rounded-lg bg-white/10 text-text-primary"
              >
                Annuleren
              </button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-accent text-bg-dark font-semibold hover:brightness-110 transition-all shadow-[0_2px_8px_rgba(201,168,76,0.3)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100 flex items-center gap-2">
                {saving && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDelete}
        title="Gebruiker verwijderen"
        message={`Weet je zeker dat je "${deletingUser?.username}" wilt verwijderen?`}
      />
    </div>
  );
}
