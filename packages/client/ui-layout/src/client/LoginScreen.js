import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { SaddleLogo } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './LoginScreen.module.css';
export function LoginScreen({ onLoginSuccess }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        document.body.classList.add('dark-theme');
    }, []);
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (res.ok) {
                onLoginSuccess();
            }
            else {
                setError('Invalid password');
            }
        }
        catch (_err) {
            setError('Network error');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: css.root, children: _jsxs("form", { className: css.card, onSubmit: handleLogin, children: [_jsx("div", { className: css.logoContainer, children: _jsx(SaddleLogo, { size: 32, className: css.logoIcon }) }), _jsx("div", { className: css.title, children: "Saddle OS" }), _jsx("div", { className: css.subtitle, children: "AI Operating System" }), _jsx("div", { className: css.inputGroup, children: _jsx("input", { type: "password", className: css.input, value: password, onChange: e => setPassword(e.target.value), placeholder: "Enter Admin Password", autoFocus: true, required: true }) }), error && _jsx("div", { className: css.error, children: error }), _jsx("button", { type: "submit", className: css.button, disabled: loading, children: loading ? 'Authenticating...' : 'Secure Login' })] }) }));
}
//# sourceMappingURL=LoginScreen.js.map