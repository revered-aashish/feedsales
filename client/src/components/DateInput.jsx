/**
 * DateInput — a filter-friendly date picker.
 *
 * Problem: <input type="date" value=""> renders the current date as a visual
 * default on Chrome/Android even when no value is set, making users think a
 * filter is active when it isn't.
 *
 * Fix: render as type="text" (with a plain placeholder) when empty, and switch
 * to type="date" on focus so the native picker still works normally.
 */
export default function DateInput({ value, onChange, className, placeholder = 'All dates' }) {
  return (
    <input
      type={value ? 'date' : 'text'}
      placeholder={placeholder}
      value={value}
      onFocus={e => { e.target.type = 'date'; }}
      onBlur={e => { if (!e.target.value) e.target.type = 'text'; }}
      onChange={onChange}
      className={className}
    />
  );
}
