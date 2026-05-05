export default function Toast({ message, type = 'info' }) {
  if (!message) return null;
  return <div className={`notice notice-${type}`}>{message}</div>;
}
