export default function Field({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-muted text-xs">{label}</p>
      <p className="font-medium text-dark">{value}</p>
    </div>
  )
}
