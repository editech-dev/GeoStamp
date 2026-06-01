import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface DateTimePickerProps {
  value: string; // Formato esperado: YYYY-MM-DDTHH:MM
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAYS_OF_WEEK = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

export default function DateTimePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha y hora...',
  className = ''
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Parsear el valor actual a un objeto Date
  const getInitialDate = (val: string): Date => {
    if (!val) return new Date();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const currentDate = getInitialDate(value);

  // Estado para el mes y año que se está visualizando en el calendario flotante
  const [viewDate, setViewDate] = useState<Date>(currentDate);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setViewDate(getInitialDate(value));
  }

  // Cerrar popover al hacer clic fuera del componente
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Obtener días del mes
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleDateSelect = (dayNum: number, isCurrentMonth: boolean, isPrevMonth: boolean) => {
    let targetYear = year;
    let targetMonth = month;

    if (isPrevMonth) {
      targetMonth = month - 1;
      if (targetMonth < 0) {
        targetMonth = 11;
        targetYear -= 1;
      }
    } else if (!isCurrentMonth) {
      targetMonth = month + 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }

    const newDate = new Date(targetYear, targetMonth, dayNum, currentDate.getHours(), currentDate.getMinutes());
    
    // Actualizar la vista del calendario
    setViewDate(newDate);
    
    // Emitir el cambio en formato ISO local YYYY-MM-DDTHH:MM
    emitDateChange(newDate);
  };

  const handleTimeChange = (type: 'hours' | 'minutes', val: number) => {
    const newDate = new Date(currentDate);
    if (type === 'hours') {
      newDate.setHours(val);
    } else {
      newDate.setMinutes(val);
    }
    emitDateChange(newDate);
  };

  const emitDateChange = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yStr = date.getFullYear();
    const mStr = pad(date.getMonth() + 1);
    const dStr = pad(date.getDate());
    const hStr = pad(date.getHours());
    const minStr = pad(date.getMinutes());
    onChange(`${yStr}-${mStr}-${dStr}T${hStr}:${minStr}`);
  };

  // Formato legible para el botón disparador: DD/MM/YYYY HH:MM
  const formatDisplay = (val: string): string => {
    if (!val) return '';
    try {
      const parts = val.split('T');
      if (parts.length < 2) return val;
      const dateParts = parts[0].split('-');
      const timeParts = parts[1].split(':');
      return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]} ${timeParts[0]}:${timeParts[1]}`;
    } catch {
      return val;
    }
  };

  // Generar las celdas del calendario (42 celdas en total)
  const cells: { day: number; isCurrentMonth: boolean; isPrevMonth: boolean; isSelected: boolean }[] = [];

  // Días del mes anterior (relleno)
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    cells.push({
      day: d,
      isCurrentMonth: false,
      isPrevMonth: true,
      isSelected: false
    });
  }

  // Días del mes actual
  for (let i = 1; i <= daysInMonth; i++) {
    const isSelected = value ? (
      currentDate.getDate() === i &&
      currentDate.getMonth() === month &&
      currentDate.getFullYear() === year
    ) : false;

    cells.push({
      day: i,
      isCurrentMonth: true,
      isPrevMonth: false,
      isSelected
    });
  }

  // Días del mes siguiente (relleno para completar 42 celdas)
  const totalCells = cells.length;
  const remainingCells = 42 - totalCells;
  for (let i = 1; i <= remainingCells; i++) {
    cells.push({
      day: i,
      isCurrentMonth: false,
      isPrevMonth: false,
      isSelected: false
    });
  }

  const hoursList = Array.from({ length: 24 }, (_, i) => i);
  const minutesList = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Botón Disparador */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-input-bg border border-border-main hover:border-text-subtle rounded-xl px-3.5 py-2 text-sm text-left transition-all cursor-pointer focus:outline-none focus:border-red-600 ${className}`}
      >
        <span className={value ? 'text-text-main font-medium' : 'text-text-muted'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <CalendarIcon size={16} className="text-text-muted shrink-0 ml-2" />
      </button>
      {/* Popover/Modal del Calendario */}
      {isOpen && (
        isMobile ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setIsOpen(false)} />
            <div className="relative w-[300px] bg-card-bg border border-border-main rounded-3xl shadow-2xl p-5 animate-in zoom-in-95 duration-150">
              {/* Navegación del Mes/Año */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-panel-active rounded-lg text-text-muted hover:text-text-main transition-colors cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold text-text-main font-sans">
                  {MONTHS[month]} {year}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-panel-active rounded-lg text-text-muted hover:text-text-main transition-colors cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Días de la Semana */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {DAYS_OF_WEEK.map((d) => (
                  <span key={d} className="text-[11px] font-bold text-text-muted uppercase">
                    {d}
                  </span>
                ))}
              </div>

              {/* Cuadrícula del Calendario */}
              <div className="grid grid-cols-7 gap-1 text-center mb-4">
                {cells.map((cell, idx) => {
                  let textClass = 'text-text-main hover:bg-panel-active';
                  if (!cell.isCurrentMonth) {
                    textClass = 'text-text-subtle hover:bg-panel-active/60';
                  }
                  if (cell.isSelected) {
                    textClass = 'bg-red-600 text-white font-semibold hover:bg-red-700';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleDateSelect(cell.day, cell.isCurrentMonth, cell.isPrevMonth)}
                      className={`py-1.5 text-xs rounded-lg transition-all cursor-pointer ${textClass}`}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>

              {/* Selector de Hora y Minutos */}
              <div className="pt-3 border-t border-border-main flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-text-muted">
                  <Clock size={14} />
                  <span className="text-xs font-semibold">Hora</span>
                </div>

                <div className="flex items-center gap-1">
                  <select
                    value={value ? currentDate.getHours() : 0}
                    onChange={(e) => handleTimeChange('hours', parseInt(e.target.value))}
                    className="bg-input-bg border border-border-main rounded-lg px-2 py-1.5 text-xs text-text-main focus:outline-none focus:border-red-600 font-mono cursor-pointer"
                  >
                    {hoursList.map((h) => (
                      <option key={h} value={h}>
                        {h.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <span className="text-text-muted text-xs">:</span>
                  <select
                    value={value ? currentDate.getMinutes() : 0}
                    onChange={(e) => handleTimeChange('minutes', parseInt(e.target.value))}
                    className="bg-input-bg border border-border-main rounded-lg px-2 py-1.5 text-xs text-text-main focus:outline-none focus:border-red-600 font-mono cursor-pointer"
                  >
                    {minutesList.map((m) => (
                      <option key={m} value={m}>
                        {m.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botón Aplicar */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Check size={14} />
                Aplicar
              </button>
            </div>
          </div>
        ) : (
          <div className="absolute left-0 lg:left-auto lg:right-0 mt-2 z-50 w-[290px] bg-card-bg border border-border-main rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Navegación del Mes/Año */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-panel-active rounded-lg text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-text-main font-sans">
                {MONTHS[month]} {year}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-panel-active rounded-lg text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Días de la Semana */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {DAYS_OF_WEEK.map((d) => (
                <span key={d} className="text-[11px] font-bold text-text-muted uppercase">
                  {d}
                </span>
              ))}
            </div>

            {/* Cuadrícula del Calendario */}
            <div className="grid grid-cols-7 gap-1 text-center mb-4">
              {cells.map((cell, idx) => {
                let textClass = 'text-text-main hover:bg-panel-active';
                if (!cell.isCurrentMonth) {
                  textClass = 'text-text-subtle hover:bg-panel-active/60';
                }
                if (cell.isSelected) {
                  textClass = 'bg-red-600 text-white font-semibold hover:bg-red-700';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDateSelect(cell.day, cell.isCurrentMonth, cell.isPrevMonth)}
                    className={`py-1.5 text-xs rounded-lg transition-all cursor-pointer ${textClass}`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Selector de Hora y Minutos */}
            <div className="pt-3 border-t border-border-main flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Clock size={14} />
                <span className="text-xs font-semibold">Hora</span>
              </div>

              <div className="flex items-center gap-1">
                <select
                  value={value ? currentDate.getHours() : 0}
                  onChange={(e) => handleTimeChange('hours', parseInt(e.target.value))}
                  className="bg-input-bg border border-border-main rounded-lg px-1.5 py-1 text-xs text-text-main focus:outline-none focus:border-red-600 font-mono cursor-pointer"
                >
                  {hoursList.map((h) => (
                    <option key={h} value={h}>
                      {h.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <span className="text-text-muted text-xs">:</span>
                <select
                  value={value ? currentDate.getMinutes() : 0}
                  onChange={(e) => handleTimeChange('minutes', parseInt(e.target.value))}
                  className="bg-input-bg border border-border-main rounded-lg px-1.5 py-1 text-xs text-text-main focus:outline-none focus:border-red-600 font-mono cursor-pointer"
                >
                  {minutesList.map((m) => (
                    <option key={m} value={m}>
                      {m.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Botón Aplicar */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-2 rounded-xl flex items-center justify-center gap-1 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Check size={14} />
              Aplicar
            </button>
          </div>
        )
      )}
    </div>
  );
}
