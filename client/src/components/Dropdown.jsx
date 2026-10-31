import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

function normalizeOptions(options) {
  return (options || []).map((option) => {
    if (option && typeof option === 'object') {
      const value = option.value ?? option.v ?? '';
      return {
        value: String(value),
        label: String(option.label ?? option.l ?? value),
        disabled: Boolean(option.disabled),
      };
    }
    return { value: String(option ?? ''), label: String(option ?? '') };
  });
}

/**
 * A rounded, animated select used across the app. It keeps the familiar
 * onChange({ target: { value } }) contract while rendering a portal menu so
 * it is never clipped by cards, panels or scroll containers.
 */
export function Select({
  options = [],
  value = '',
  onChange,
  id,
  className = '',
  placeholder,
  disabled = false,
  required = false,
  ...rest
}) {
  const opts = useMemo(() => normalizeOptions(options), [options]);
  const selectedIndex = useMemo(
    () => opts.findIndex((option) => option.value === String(value ?? '')),
    [opts, value],
  );
  const firstEnabled = useMemo(() => opts.findIndex((option) => !option.disabled), [opts]);
  const lastEnabled = useMemo(() => {
    for (let i = opts.length - 1; i >= 0; i -= 1) if (!opts[i].disabled) return i;
    return -1;
  }, [opts]);

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const typeahead = useRef({ buffer: '', last: 0, timer: null });
  const baseId = useId();
  const triggerId = id || `${baseId}-trigger`;
  const menuId = `${baseId}-menu`;

  const selected = selectedIndex >= 0 ? opts[selectedIndex] : undefined;
  const display = selected ? selected.label : (placeholder ?? '');

  const openMenu = useCallback((index) => {
    if (disabled) return;
    const next = typeof index === 'number'
      ? index
      : (selectedIndex >= 0 ? selectedIndex : firstEnabled);
    setActive(next);
    setOpen(true);
  }, [disabled, selectedIndex, firstEnabled]);

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const choose = useCallback((index) => {
    const option = opts[index];
    if (!option || option.disabled) return;
    if (option.value !== String(value ?? '')) {
      onChange?.({ target: { value: option.value } });
    }
    closeMenu(true);
  }, [opts, value, onChange, closeMenu]);

  const step = useCallback((direction) => {
    if (!opts.length) return;
    let index = active;
    for (let i = 0; i < opts.length; i += 1) {
      index = (index + direction + opts.length) % opts.length;
      if (!opts[index].disabled) {
        setActive(index);
        return;
      }
    }
  }, [active, opts]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }

    setShown(false);
    if (!mounted) return undefined;
    const timer = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!open || !mounted || !position || shown) return undefined;
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [open, mounted, position, shown]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(Math.max(rect.width, 208), Math.max(160, viewportWidth - 16));
      let left = rect.left;
      if (left + width > viewportWidth - 8) left = viewportWidth - width - 8;
      if (left < 8) left = 8;

      const belowSpace = viewportHeight - rect.bottom - 10;
      const aboveSpace = rect.top - 10;
      const preferredHeight = Math.min(320, Math.max(0, opts.length * 40 + 12));
      const placement = belowSpace < Math.min(preferredHeight, 200) && aboveSpace > belowSpace ? 'above' : 'below';
      const maxHeight = Math.max(140, Math.min(320, placement === 'below' ? belowSpace : aboveSpace));

      setPosition({
        placement,
        style: {
          left: `${left}px`,
          width: `${width}px`,
          maxHeight: `${maxHeight}px`,
          ...(placement === 'below'
            ? { top: `${rect.bottom + 6}px` }
            : { bottom: `${viewportHeight - rect.top + 6}px` }),
        },
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, opts.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  useEffect(() => {
    if (!open || active < 0) return;
    const node = menuRef.current?.querySelector(`[data-index="${active}"]`);
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  useEffect(() => () => {
    if (typeahead.current.timer) clearTimeout(typeahead.current.timer);
  }, []);

  const runTypeahead = (char) => {
    const state = typeahead.current;
    const now = Date.now();
    state.buffer = now - state.last < 650 ? `${state.buffer}${char}` : char;
    state.last = now;
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => { state.buffer = ''; }, 700);
    const needle = state.buffer.toLowerCase();
    const found = opts.findIndex((option) => !option.disabled && option.label.toLowerCase().startsWith(needle));
    if (found >= 0) {
      if (open) setActive(found);
      else openMenu(found);
    }
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (open) step(1); else openMenu();
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (open) step(-1); else openMenu();
        break;
      case 'Home':
        if (open) { event.preventDefault(); setActive(firstEnabled); }
        break;
      case 'End':
        if (open) { event.preventDefault(); setActive(lastEnabled); }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open) choose(active >= 0 ? active : firstEnabled);
        else openMenu();
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          closeMenu(true);
        }
        break;
      case 'Tab':
        if (open) setOpen(false);
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          runTypeahead(event.key);
        }
    }
  };

  const menu = mounted && position ? createPortal(
    <div
      ref={menuRef}
      id={menuId}
      role="listbox"
      aria-labelledby={triggerId}
      className={`dropdown-menu ${position.placement === 'above' ? 'is-above' : ''} ${shown ? 'is-open' : ''}`}
      style={position.style}
    >
      {opts.map((option, index) => {
        const isSelected = option.value === String(value ?? '');
        return (
          <button
            key={`${option.value}-${index}`}
            type="button"
            role="option"
            id={`${menuId}-${index}`}
            data-index={index}
            data-active={index === active ? 'true' : 'false'}
            aria-selected={isSelected}
            disabled={option.disabled}
            className="dropdown-option"
            onMouseEnter={() => !option.disabled && setActive(index)}
            onClick={() => choose(index)}
          >
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            <Check
              className={`h-3.5 w-3.5 shrink-0 text-brand transition-opacity duration-150 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        {...rest}
        id={triggerId}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open && active >= 0 ? `${menuId}-${active}` : undefined}
        aria-required={required || undefined}
        className={`input select-trigger ${className}`.trim()}
        onClick={() => { if (open) closeMenu(); else openMenu(); }}
        onKeyDown={handleKeyDown}
      >
        <span className="select-value">{display}</span>
        <ChevronDown className="select-chevron" aria-hidden="true" />
      </button>
      {menu}
    </>
  );
}
