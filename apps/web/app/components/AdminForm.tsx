'use client';

import type { ReactNode } from 'react';

type AdminFormProps = {
  eyebrow: string;
  title: string;
  description?: string;
  onReset?: () => void;
  resetLabel?: string;
  children: ReactNode;
  /** Optional className applied to outer <section> */
  className?: string;
  /** Forwarded ref for scroll-into-view */
  sectionRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Minimalist wrapper for admin create/edit forms.
 * Renders a clean card with a single header row (eyebrow + title + optional reset)
 * and a content slot for the actual <form>.
 *
 * Usage:
 *   <AdminForm
 *     eyebrow={form.id ? 'Editar servicio' : 'Nuevo servicio'}
 *     title={form.id ? 'Actualizar servicio' : 'Crear servicio'}
 *     onReset={resetForm}
 *     sectionRef={formRef}
 *   >
 *     <form className="auth-form" onSubmit={handleSubmit}>...</form>
 *   </AdminForm>
 */
export const AdminForm = ({
  eyebrow,
  title,
  description,
  onReset,
  resetLabel = 'Limpiar',
  children,
  className,
  sectionRef
}: AdminFormProps) => {
  const classes = ['card', 'admin-form-card', 'reveal'];
  if (className) classes.push(className);

  return (
    <section ref={sectionRef} className={classes.join(' ')}>
      <header className="admin-form-head">
        <div className="admin-form-head-text">
          <div className="eyebrow">{eyebrow}</div>
          <h2>{title}</h2>
          {description && <p className="admin-form-head-desc">{description}</p>}
        </div>
        {onReset && (
          <button className="chip" type="button" onClick={onReset}>
            {resetLabel}
          </button>
        )}
      </header>
      <div className="admin-form-body">{children}</div>
    </section>
  );
};
