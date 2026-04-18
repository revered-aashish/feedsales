import { useState, useEffect, useRef } from 'react';
import { FiSearch, FiX, FiChevronDown, FiCheck } from 'react-icons/fi';

/**
 * CustomerSearchSelect — mobile-friendly searchable customer picker.
 *
 * Props:
 *   customers    – array of { id, company, name }
 *   value        – current selected customer id (string or number, '' = none)
 *   onChange     – (id: string) => void   ('' when cleared)
 *   disabledIds  – string[] of customer ids to disable (already selected elsewhere)
 *   placeholder  – text shown when nothing selected (default 'Select Customer *')
 *   className    – extra classes on the wrapper div
 */
export default function CustomerSearchSelect({
  customers = [],
  value,
  onChange,
  disabledIds = [],
  placeholder = 'Select Customer *',
  className = '',
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selected = customers.find(c => String(c.id) === String(value));

  // Close on outside click / touch
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = customers.filter(c => {
    const label = (c.company || c.name || '').toLowerCase();
    return label.includes(search.toLowerCase());
  });

  const handleOpen = () => {
    setOpen(true);
    setSearch('');
  };

  const handleSelect = (customer) => {
    const id = String(customer.id);
    const isDisabled = disabledIds.includes(id) && id !== String(value);
    if (isDisabled) return;
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setSearch(''); }
    if (e.key === 'Enter' && filtered.length === 1) {
      const c = filtered[0];
      if (!disabledIds.includes(String(c.id)) || String(c.id) === String(value)) {
        handleSelect(c);
      }
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Trigger row */}
      <div
        role="combobox"
        aria-expanded={open}
        onClick={handleOpen}
        className={`w-full flex items-center gap-2 px-3 py-2 border rounded-lg text-sm bg-white cursor-pointer
          ${open ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        {open ? (
          /* Search input */
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search customer…"
            className="flex-1 outline-none bg-transparent text-sm text-gray-800 placeholder-gray-400"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className={`flex-1 truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}>
            {selected ? (selected.company || selected.name) : placeholder}
          </span>
        )}

        <div className="flex items-center gap-1 shrink-0 text-gray-400">
          {value && !open && (
            <button
              type="button"
              onMouseDown={handleClear}
              className="hover:text-gray-600 p-0.5 rounded cursor-pointer"
              tabIndex={-1}
              aria-label="Clear selection"
            >
              <FiX size={13} />
            </button>
          )}
          {open
            ? <FiSearch size={14} className="text-indigo-400" />
            : <FiChevronDown size={14} />
          }
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[100] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">
              No customers found for "{search}"
            </div>
          ) : (
            filtered.map(c => {
              const id = String(c.id);
              const isSelected = id === String(value);
              const isDisabled = disabledIds.includes(id) && !isSelected;
              const label = c.company || c.name;
              return (
                <div
                  key={c.id}
                  onMouseDown={() => handleSelect(c)}
                  onTouchEnd={() => handleSelect(c)}
                  className={`px-3 py-2.5 text-sm flex items-center justify-between gap-2
                    ${isDisabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : isSelected
                        ? 'bg-indigo-50 text-indigo-700 font-medium cursor-pointer'
                        : 'text-gray-700 hover:bg-gray-50 cursor-pointer active:bg-gray-100'
                    }
                  `}
                >
                  <span className="truncate">{label}</span>
                  {isSelected && <FiCheck size={14} className="shrink-0 text-indigo-500" />}
                  {isDisabled && <span className="text-[11px] text-gray-300 shrink-0">selected</span>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
