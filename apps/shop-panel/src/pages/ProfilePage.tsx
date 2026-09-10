import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyShop, updateMyShop, ShopHours } from '../api/shops';
import { LoadingState, ErrorState } from '../components/PageState';

const WEEKDAYS: { key: keyof ShopHours; label: string }[] = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

export function ProfilePage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['shop', 'me'], queryFn: getMyShop });

  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [greetingMessage, setGreetingMessage] = useState('');
  const [hours, setHours] = useState<ShopHours>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    setAddress(query.data.address);
    setLat(String(query.data.lat));
    setLng(String(query.data.lng));
    setWhatsapp(query.data.whatsapp ?? '');
    setInstagram(query.data.instagram ?? '');
    setGreetingMessage(query.data.greetingMessage ?? '');
    setHours(query.data.hours ?? {});
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateMyShop({
        address,
        lat: Number(lat),
        lng: Number(lng),
        whatsapp: whatsapp || null,
        instagram: instagram || null,
        greetingMessage: greetingMessage || null,
        hours,
      }),
    onSuccess: (shop) => {
      queryClient.setQueryData(['shop', 'me'], shop);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  if (query.isLoading) return <LoadingState label="Carregando perfil…" />;
  if (query.isError || !query.data) return <ErrorState message="Não foi possível carregar o perfil da loja." />;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Perfil da loja</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>{query.data.tradeName}</p>

      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label className="field-label" htmlFor="address">
            Endereço
          </label>
          <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="lat">
              Latitude
            </label>
            <input
              id="lat"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="lng">
              Longitude
            </label>
            <input
              id="lng"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              required
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="whatsapp">
              WhatsApp
            </label>
            <input
              id="whatsapp"
              placeholder="(11) 99999-9999"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="instagram">
              Instagram
            </label>
            <input
              id="instagram"
              placeholder="@suacharutaria"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="greeting">
            Mensagem automática de saudação
          </label>
          <textarea
            id="greeting"
            rows={3}
            value={greetingMessage}
            onChange={(e) => setGreetingMessage(e.target.value)}
            placeholder="Ex.: Olá! Obrigado por entrar em contato com nosso umidor. Em breve responderemos."
          />
        </div>

        <div className="field">
          <label className="field-label">Horário de atendimento</label>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 12, marginBottom: 12 }}>
            Formato livre por dia, ex.: "09:00-18:00" ou "Fechado".
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {WEEKDAYS.map((day) => (
              <div key={day.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ width: 80, fontSize: 13, color: 'var(--color-text-secondary)' }}>{day.label}</label>
                <input
                  value={hours[day.key] ?? ''}
                  onChange={(e) => setHours((h) => ({ ...h, [day.key]: e.target.value }))}
                  placeholder="09:00-18:00"
                  style={{ flex: 1 }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : 'Salvar alterações'}
          </button>
          {saved && <span style={{ color: 'var(--color-positive)', fontSize: 13 }}>Salvo com sucesso.</span>}
          {mutation.isError && (
            <span style={{ color: 'var(--color-alert)', fontSize: 13 }}>Não foi possível salvar.</span>
          )}
        </div>
      </form>
    </div>
  );
}
