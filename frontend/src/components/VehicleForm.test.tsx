import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VehicleForm } from './VehicleForm';

async function fill(values: Partial<Record<string, string>>) {
  const user = userEvent.setup();
  const labels: Record<string, RegExp> = {
    make: /marca/i,
    model: /modelo/i,
    year: /año/i,
    mileageKm: /kilometraje/i,
    obdCodes: /obd-ii/i,
    symptoms: /síntomas/i,
  };
  for (const [k, v] of Object.entries(values)) {
    if (v) await user.type(screen.getByLabelText(labels[k]!), v);
  }
  return user;
}

describe('VehicleForm', () => {
  it('renderiza todos los campos', () => {
    render(<VehicleForm onSubmit={vi.fn()} />);
    for (const label of [/marca/i, /modelo/i, /año/i, /kilometraje/i, /obd-ii/i, /síntomas/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('bloquea el envio con kilometraje negativo y muestra el error', async () => {
    const onSubmit = vi.fn();
    render(<VehicleForm onSubmit={onSubmit} />);
    const user = await fill({ make: 'Mazda', model: '3', year: '2020', mileageKm: '-100' });
    await user.click(screen.getByRole('button', { name: /revisar/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/no puede ser negativo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/kilometraje/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('bloquea el envio con campos requeridos vacios', async () => {
    const onSubmit = vi.fn();
    render(<VehicleForm onSubmit={onSubmit} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /revisar/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/marca es obligatoria/i)).toBeInTheDocument();
  });

  it('envia datos validados y normaliza codigos OBD-II', async () => {
    const onSubmit = vi.fn();
    render(<VehicleForm onSubmit={onSubmit} />);
    const user = await fill({ make: 'Chevrolet', model: 'Spark', year: '2018', mileageKm: '60000', obdCodes: 'p0300, P0420' });
    await user.click(screen.getByRole('button', { name: /revisar/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      make: 'Chevrolet',
      model: 'Spark',
      year: 2018,
      mileageKm: 60000,
      symptoms: '',
      obdCodes: ['P0300', 'P0420'],
    });
  });

  it('muestra estado de carga y deshabilita el boton', () => {
    render(<VehicleForm onSubmit={vi.fn()} loading />);
    expect(screen.getByRole('button', { name: /analizando/i })).toBeDisabled();
  });

  it('muestra errores del servidor por campo', () => {
    render(<VehicleForm onSubmit={vi.fn()} serverErrors={{ 'obdCodes.0': 'Código OBD-II inválido' }} />);
    expect(screen.getByText(/código obd-ii inválido/i)).toBeInTheDocument();
  });

  it('permite agregar codigos OBD-II y sintomas rapidos sin duplicar', async () => {
    const user = userEvent.setup();
    render(<VehicleForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '+ P0300' }));
    await user.click(screen.getByRole('button', { name: '+ P0300' }));
    await user.click(screen.getByRole('button', { name: '+ P0420' }));
    expect(screen.getByLabelText(/obd-ii/i)).toHaveValue('P0300, P0420');

    await user.click(screen.getByRole('button', { name: '+ Tironea en ralentí' }));
    await user.click(screen.getByRole('button', { name: '+ Tironea en ralentí' }));
    expect(screen.getByLabelText(/síntomas/i)).toHaveValue('Tironea en ralentí');
  });
});
