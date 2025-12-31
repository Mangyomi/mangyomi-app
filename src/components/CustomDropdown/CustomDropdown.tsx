import { useState, useRef, useEffect } from 'react';
import './CustomDropdown.css';

interface DropdownOption {
    value: string;
    label: string;
}

interface CustomDropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

function CustomDropdown({ options, value, onChange, placeholder = 'Select...' }: CustomDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className={`custom-dropdown ${isOpen ? 'open' : ''}`} ref={dropdownRef}>
            <button
                className="dropdown-trigger"
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className="dropdown-value">{selectedOption?.label || placeholder}</span>
                <span className="dropdown-arrow">▾</span>
            </button>

            {isOpen && (
                <div className="dropdown-menu">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            className={`dropdown-option ${option.value === value ? 'selected' : ''}`}
                            onClick={() => handleSelect(option.value)}
                            type="button"
                        >
                            {option.label}
                            {option.value === value && <span className="check-mark">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default CustomDropdown;
