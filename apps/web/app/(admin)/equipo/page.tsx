"use client";

import { useEffect, useRef, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';
import { normalizePersonName, normalizePhone } from '../../lib/validation';

type Staff = {
  id: number;
  name: string;
  role?: string | null;
  phone?: string | null;
  active: boolean;
  serviceIds?: number[];
};
type Service = { id: number; name: string };

const createEmptyForm = () => ({
  id: null as number | null,
  name: '',
  role: '',
  phone: ''
});

export default function EquipoPage() {
  const [team, setTeam] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState(createEmptyForm());
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [error, setError] = useState('');
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

    try {
      await staffFetch(form.id ? `/staff/${form.id}` : '/staff', {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role.trim(),
          phone: form.phone.trim()
        })
      });
      resetForm();
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    }
  };

  const handleEdit = (member: Staff) => {
    setForm({
      id: member.id,
      name: member.name,
      role: member.role ?? '',
      phone: member.phone ?? ''
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (member: Staff) => {
    const confirmed = window.confirm(`Eliminar a ${member.name}? Quedara archivado como inactivo.`);
    if (!confirmed) return;

    setError('');
    try {
      await staffFetch(`/staff/${member.id}`, { method: 'DELETE' });
      if (form.id === member.id) {
        resetForm();
      }
      if (selectedStaff?.id === member.id) {
        setSelectedStaff(null);
        setSelectedServices([]);
      }
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
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
    <div className="page-stack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Equipo en turno</div>
          <h1>Coordinacion con elegancia</h1>
          <p>Visualiza turnos, roles y disponibilidad en tiempo real.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => {
            resetForm();
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>
            Nuevo personal
          </button>
        </div>
      </header>

      <section className="card reveal" ref={formRef}>
        <div className="section-head">
          <div>
            <div className="eyebrow">{form.id ? 'Editar personal' : 'Nuevo personal'}</div>
            <h2>{form.id ? 'Actualizar colaborador' : 'Registrar colaborador'}</h2>
          </div>
          <button className="chip" type="button" onClick={resetForm}>Limpiar</button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Nombre
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
            <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </label>
          <label>
            Telefono
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: normalizePhone(e.target.value) })}
              inputMode="numeric"
              pattern="[0-9]+"
              title="Solo se permiten numeros"
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn" type="submit">{form.id ? 'Actualizar' : 'Guardar'}</button>
        </form>
      </section>

      {selectedStaff && (
        <section className="card reveal">
          <div className="section-head">
            <div>
              <div className="eyebrow">Servicios asignados</div>
              <h2>{selectedStaff.name}</h2>
            </div>
            <button className="chip" onClick={() => {
              setSelectedStaff(null);
              setSelectedServices([]);
            }}>Cerrar</button>
          </div>
          <div className="chip-row">
            {services.map((service) => (
              <label key={service.id} className="chip">
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
          </div>
          <button className="btn" onClick={saveServices}>Guardar servicios</button>
        </section>
      )}

      <section className="grid grid-2">
        {team.map((member, index) => (
          <div
            key={member.id}
            className="card reveal"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="team-row">
              <div className="avatar">{member.name.split(' ').map((w) => w[0]).join('')}</div>
              <div>
                <div className="list-title">{member.name}</div>
                <div className="list-sub">{member.role ?? 'Equipo'}{member.phone ? ` · ${member.phone}` : ''}</div>
              </div>
            </div>
            <div className="team-meta">
              <span className="pill">{member.serviceIds?.length ?? 0} servicios</span>
              <span className={`status-badge ${member.active ? 'status-ok' : 'status-warn'}`}>
                {member.active ? 'Disponible' : 'Inactivo'}
              </span>
            </div>
            <div className="service-actions">
              <button className="chip" onClick={() => handleEdit(member)}>Editar</button>
              <button className="chip" onClick={() => {
                setSelectedStaff(member);
                setSelectedServices(member.serviceIds ?? []);
              }}>Asignar servicios</button>
              <button className="chip" onClick={() => toggleActive(member)}>
                {member.active ? 'Desactivar' : 'Activar'}
              </button>
              <button className="chip" onClick={() => handleDelete(member)}>Eliminar</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
