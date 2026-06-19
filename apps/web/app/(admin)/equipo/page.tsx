"use client";

import { useEffect, useRef, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';
import { normalizePersonName, normalizePhone } from '../../lib/validation';
import AvatarUploader from '../../components/AvatarUploader';
import ConfirmDialog from '../../components/ConfirmDialog';
import { AdminForm } from '../../components/AdminForm';
import MoraScrollReveal from '../../components/MoraScrollReveal';

type Staff = {
  id: number;
  name: string;
  role?: string | null;
  phone?: string | null;
  active: boolean;
  avatarUrl?: string | null;
  serviceIds?: number[];
};
type Service = { id: number; name: string };

type StaffForm = {
  id: number | null;
  name: string;
  role: string;
  phone: string;
  avatarUrl: string;
};

const createEmptyForm = (): StaffForm => ({
  id: null,
  name: '',
  role: '',
  phone: '',
  avatarUrl: ''
});

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EQ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function EquipoPage() {
  const [team, setTeam] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState<StaffForm>(createEmptyForm());
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    Promise.all([
      staffFetch<{ data: Staff[] }>('/staff'),
      staffFetch<{ data: Service[] }>('/services')
    ])
      .then(([staffRes, servicesRes]) => {
        setTeam(staffRes.data ?? []);
        setServices(servicesRes.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm(createEmptyForm());
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        role: form.role.trim() || undefined,
        phone: form.phone.trim() || undefined,
        avatarUrl: form.avatarUrl.trim() || null
      };
      await staffFetch(form.id ? `/staff/${form.id}` : '/staff', {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      resetForm();
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (member: Staff) => {
    setForm({
      id: member.id,
      name: member.name,
      role: member.role ?? '',
      phone: member.phone ?? '',
      avatarUrl: member.avatarUrl ?? ''
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    try {
      await staffFetch(`/staff/${confirmDelete.id}`, { method: 'DELETE' });
      if (form.id === confirmDelete.id) resetForm();
      if (selectedStaff?.id === confirmDelete.id) {
        setSelectedStaff(null);
        setSelectedServices([]);
      }
      loadData();
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (member: Staff) => {
    try {
      await staffFetch(`/staff/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !member.active })
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const saveServices = async () => {
    if (!selectedStaff) return;
    try {
      await staffFetch(`/staff/${selectedStaff.id}/services`, {
        method: 'PUT',
        body: JSON.stringify({ serviceIds: selectedServices })
      });
      setSelectedStaff(null);
      setSelectedServices([]);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar');
    }
  };

  return (
    <div className="page-stack page-enter">
      <header className="page-head">
        <div>
          <div className="eyebrow">Equipo en turno</div>
          <h1>Coordinacion con elegancia</h1>
          <p>Visualiza turnos, roles y disponibilidad en tiempo real.</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary shine-on-hover press-feedback"
            onClick={() => {
              resetForm();
              formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            Nuevo personal
          </button>
        </div>
      </header>

      <AdminForm
        eyebrow={form.id ? 'Editar personal' : 'Nuevo personal'}
        title={form.id ? 'Actualizar colaborador' : 'Registrar colaborador'}
        onReset={resetForm}
        sectionRef={formRef}
      >
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-row-2">
            <label>
              Nombre completo
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: normalizePersonName(e.target.value) })}
                pattern="[A-Za-zÀ-ÿ\s]+"
                title="Solo se permiten letras y espacios"
              />
            </label>
            <label>
              Rol
              <input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="Estilista principal"
              />
            </label>
          </div>
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: normalizePhone(e.target.value) })}
              inputMode="numeric"
              pattern="[0-9]+"
              title="Solo se permiten numeros"
            />
          </label>

          <div className="form-section">
            <AvatarUploader
              bucket="staff"
              value={form.avatarUrl}
              fallbackInitials={initialsOf(form.name || 'Nuevo')}
              onChange={(url) => setForm({ ...form, avatarUrl: url })}
              size={104}
              label="Avatar del colaborador"
            />
            <p className="form-hint">Imagen cuadrada recomendada (PNG/JPG/WebP, max 5MB).</p>
          </div>

          {error && <div className="auth-error">{error}</div>}
          <div className="form-actions">
            <button className="btn btn-primary shine-on-hover press-feedback" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : form.id ? 'Actualizar colaborador' : 'Guardar colaborador'}
            </button>
          </div>
        </form>
      </AdminForm>

      {selectedStaff && (
        <section className="card reveal">
          <div className="section-head">
            <div>
              <div className="eyebrow">Servicios asignados</div>
              <h2>{selectedStaff.name}</h2>
            </div>
            <button
              className="chip press-feedback"
              onClick={() => {
                setSelectedStaff(null);
                setSelectedServices([]);
              }}
            >
              Cerrar
            </button>
          </div>
          <MoraScrollReveal as="div" className="chip-row" selector=".chip" variant="fade-up" stagger={0.04} duration={0.4}>
            {services.map((service) => (
              <label key={service.id} className="chip press-feedback">
                <input
                  type="checkbox"
                  checked={selectedServices.includes(service.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedServices([...selectedServices, service.id]);
                    } else {
                      setSelectedServices(selectedServices.filter((id) => id !== service.id));
                    }
                  }}
                />
                {service.name}
              </label>
            ))}
          </MoraScrollReveal>
          <button className="btn btn-primary shine-on-hover press-feedback" onClick={saveServices}>
            Guardar servicios
          </button>
        </section>
      )}

      <MoraScrollReveal as="section" className="grid grid-2" selector=".card.lift-on-hover" variant="fade-up" stagger={0.08} duration={0.6}>
        {team.length === 0 && (
          <div className="card empty-state">
            <div className="empty-state-icon">EQ</div>
            <h3>Aún no hay colaboradores</h3>
            <p>Añade al primero con el boton superior.</p>
          </div>
        )}
        {team.map((member, index) => {
          const initials = initialsOf(member.name);
          return (
            <div
              key={member.id}
              className="card lift-on-hover reveal"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="team-row">
                <div className="avatar avatar-lg">
                  {member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.avatarUrl} alt={member.name} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div>
                  <div className="list-title">{member.name}</div>
                  <div className="list-sub">
                    {member.role ?? 'Equipo'}
                    {member.phone ? ` · ${member.phone}` : ''}
                  </div>
                </div>
              </div>
              <div className="team-meta">
                <span className="pill">{member.serviceIds?.length ?? 0} servicios</span>
                <span className={`status-pill ${member.active ? 'status-on' : 'status-off'}`}>
                  {member.active ? 'Disponible' : 'Inactivo'}
                </span>
              </div>
              <div className="service-actions">
                <button className="chip press-feedback" onClick={() => handleEdit(member)}>
                  Editar
                </button>
                <button
                  className="chip press-feedback"
                  onClick={() => {
                    setSelectedStaff(member);
                    setSelectedServices(member.serviceIds ?? []);
                  }}
                >
                  Asignar servicios
                </button>
                <button className="chip press-feedback" onClick={() => toggleActive(member)}>
                  {member.active ? 'Desactivar' : 'Activar'}
                </button>
                <button className="chip chip-danger press-feedback" onClick={() => setConfirmDelete(member)}>
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </MoraScrollReveal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar colaborador"
        description={`Eliminar a "${confirmDelete?.name}"? Quedara archivado cómo inactivo y no aparecera disponible para reservas.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
