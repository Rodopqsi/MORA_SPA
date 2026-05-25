"use client";

import { useEffect, useRef, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

type Staff = { id: number; name: string; role?: string | null; active: boolean };
type Service = { id: number; name: string };

export default function EquipoPage() {
  const [team, setTeam] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState({ name: '', role: '', phone: '' });
  const [selectedStaff, setSelectedStaff] = useState<number | null>(null);
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

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await staffFetch('/staff', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          role: form.role,
          phone: form.phone
        })
      });
      setForm({ name: '', role: '', phone: '' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
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
      await staffFetch(`/staff/${selectedStaff}/services`, {
        method: 'PUT',
        body: JSON.stringify({ serviceIds: selectedServices })
      });
      setSelectedStaff(null);
      setSelectedServices([]);
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
          <button className="btn" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            Nuevo personal
          </button>
        </div>
      </header>

      <section className="card reveal" ref={formRef}>
        <div className="section-head">
          <div>
            <div className="eyebrow">Nuevo personal</div>
            <h2>Registrar colaborador</h2>
          </div>
        </div>
        <form className="auth-form" onSubmit={handleCreate}>
          <label>
            Nombre
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Rol
            <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </label>
          <label>
            Telefono
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn" type="submit">Guardar</button>
        </form>
      </section>

      {selectedStaff && (
        <section className="card reveal">
          <div className="section-head">
            <div>
              <div className="eyebrow">Servicios asignados</div>
              <h2>Selecciona servicios</h2>
            </div>
            <button className="chip" onClick={() => setSelectedStaff(null)}>Cerrar</button>
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
                <div className="list-sub">{member.role ?? 'Equipo'}</div>
              </div>
            </div>
            <div className="team-meta">
              <span className="pill">Estado</span>
              <span className={`status-badge ${member.active ? 'status-ok' : 'status-warn'}`}>
                {member.active ? 'Disponible' : 'Inactivo'}
              </span>
            </div>
            <div className="service-actions">
              <button className="chip" onClick={() => setSelectedStaff(member.id)}>Asignar servicios</button>
              <button className="chip" onClick={() => toggleActive(member)}>
                {member.active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
