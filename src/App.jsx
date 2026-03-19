import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { isSupabaseConfigured, supabase } from './supabaseClient'

const initialServices = [
  { id: 'corte-feminino', name: 'Corte Feminino', price: 80, duration: 60 },
  { id: 'escova', name: 'Escova', price: 55, duration: 40 },
  { id: 'coloracao', name: 'Coloracao', price: 180, duration: 120 },
  { id: 'hidratacao', name: 'Hidratacao Profunda', price: 95, duration: 50 },
  { id: 'manicure', name: 'Manicure', price: 40, duration: 40 },
  { id: 'sobrancelha', name: 'Design de Sobrancelha', price: 35, duration: 30 }
]

const availableSlots = [
  '09:00',
  '10:00',
  '11:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00'
]

const SERVICES_STORAGE_KEY = 'agenda_beleza_services'
const APPOINTMENTS_STORAGE_KEY = 'agenda_beleza_appointments'
const ADMIN_SESSION_KEY = 'agenda_beleza_admin_unlocked'
const ADMIN_PIN_STORAGE_KEY = 'agenda_beleza_admin_pin'
const ADMIN_LOGIN_ATTEMPTS_KEY = 'agenda_beleza_admin_attempts'
const ADMIN_LOCK_UNTIL_KEY = 'agenda_beleza_admin_lock_until'
const DEFAULT_ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234'
const MAX_ADMIN_ATTEMPTS = 5
const ADMIN_LOCK_MINUTES = 10
const SALON_WHATSAPP_PHONE = '5527998891683'

const APPOINTMENT_STATUS = {
  PENDING: 'pendente',
  CONFIRMED: 'confirmado',
  CANCELED: 'cancelado'
}

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

function formatDateBR(dateISO) {
  if (!dateISO) return '-'
  const [year, month, day] = String(dateISO).split('-')
  if (!year || !month || !day) return dateISO
  return `${day}/${month}/${year}`
}

function buildAppointmentsMessage(items) {
  if (!items.length) {
    return 'Nenhum agendamento para exportar.'
  }

  const lines = ['Agenda Studio Lucia Soares', '']

  items.forEach((appointment, index) => {
    lines.push(
      `${index + 1}. ${appointment.clientName}`,
      `Data: ${formatDateBR(appointment.date)} as ${appointment.time}`,
      `Servicos: ${appointment.services.join(' + ')}`,
      `Total: ${formatCurrency(appointment.totalPrice)} | Duracao: ${appointment.totalDuration} min`,
      appointment.phone ? `Telefone: ${appointment.phone}` : '',
      appointment.notes ? `Obs: ${appointment.notes}` : '',
      ''
    )
  })

  return lines.filter(Boolean).join('\n')
}

function loadStorage(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallbackValue
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : fallbackValue
  } catch {
    return fallbackValue
  }
}

function loadTextStorage(key, fallbackValue) {
  try {
    const value = localStorage.getItem(key)
    return value || fallbackValue
  } catch {
    return fallbackValue
  }
}

function mapDatabaseAppointment(row) {
  return {
    id: row.id,
    clientName: row.client_name,
    phone: row.phone,
    date: row.date,
    time: row.time,
    notes: row.notes || '',
    services: Array.isArray(row.services) ? row.services : [],
    totalPrice: Number(row.total_price) || 0,
    totalDuration: Number(row.total_duration) || 0,
    status: row.status || APPOINTMENT_STATUS.PENDING
  }
}

function App() {
  const [viewMode, setViewMode] = useState('cliente')
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminPin, setAdminPin] = useState(() => loadTextStorage(ADMIN_PIN_STORAGE_KEY, DEFAULT_ADMIN_PIN))
  const [currentPinInput, setCurrentPinInput] = useState('')
  const [newPinInput, setNewPinInput] = useState('')
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('')
  const [adminAttemptsLeft, setAdminAttemptsLeft] = useState(() => {
    const saved = Number(sessionStorage.getItem(ADMIN_LOGIN_ATTEMPTS_KEY))
    return Number.isFinite(saved) && saved > 0 ? saved : MAX_ADMIN_ATTEMPTS
  })
  const [adminLockUntil, setAdminLockUntil] = useState(() => sessionStorage.getItem(ADMIN_LOCK_UNTIL_KEY) || '')
  const [adminAuthError, setAdminAuthError] = useState('')
  const [services, setServices] = useState(() => loadStorage(SERVICES_STORAGE_KEY, initialServices))
  const [selectedServices, setSelectedServices] = useState([])
  const [formData, setFormData] = useState({
    clientName: '',
    phone: '',
    date: getTodayDate(),
    time: '',
    notes: ''
  })
  const [appointments, setAppointments] = useState(() => loadStorage(APPOINTMENTS_STORAGE_KEY, []))
  const [feedback, setFeedback] = useState('')
  const [adminFeedback, setAdminFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSyncLoading, setIsSyncLoading] = useState(isSupabaseConfigured)
  const [appointmentFilterDate, setAppointmentFilterDate] = useState('')
  const [newService, setNewService] = useState({
    name: '',
    price: '',
    duration: ''
  })

  const selectedServiceData = useMemo(
    () => services.filter((service) => selectedServices.includes(service.id)),
    [selectedServices]
  )

  const totalPrice = useMemo(
    () => selectedServiceData.reduce((sum, service) => sum + service.price, 0),
    [selectedServiceData]
  )

  const totalDuration = useMemo(
    () => selectedServiceData.reduce((sum, service) => sum + service.duration, 0),
    [selectedServiceData]
  )

  const filteredAppointments = useMemo(() => {
    if (!appointmentFilterDate) return appointments
    return appointments.filter((appointment) => appointment.date === appointmentFilterDate)
  }, [appointments, appointmentFilterDate])

  useEffect(() => {
    const validIds = new Set(services.map((service) => service.id))
    setSelectedServices((current) => current.filter((id) => validIds.has(id)))
  }, [services])

  useEffect(() => {
    localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(services))
  }, [services])

  useEffect(() => {
    localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(appointments))
  }, [appointments])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return
    }

    let isMounted = true

    const loadRemoteAppointments = async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('created_at', { ascending: false })

      if (!isMounted) return

      if (error) {
        setFeedback('Falha na sincronizacao online. Usando dados locais neste dispositivo.')
        setIsSyncLoading(false)
        return
      }

      setAppointments((data || []).map(mapDatabaseAppointment))
      setIsSyncLoading(false)
    }

    loadRemoteAppointments()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    sessionStorage.setItem(ADMIN_SESSION_KEY, String(isAdminUnlocked))
  }, [isAdminUnlocked])

  useEffect(() => {
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, adminPin)
  }, [adminPin])

  useEffect(() => {
    sessionStorage.setItem(ADMIN_LOGIN_ATTEMPTS_KEY, String(adminAttemptsLeft))
  }, [adminAttemptsLeft])

  useEffect(() => {
    if (adminLockUntil) {
      sessionStorage.setItem(ADMIN_LOCK_UNTIL_KEY, adminLockUntil)
    } else {
      sessionStorage.removeItem(ADMIN_LOCK_UNTIL_KEY)
    }
  }, [adminLockUntil])

  const handleSelectService = (serviceId) => {
    setSelectedServices((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    )
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleServiceFieldChange = (serviceId, field, value) => {
    setServices((current) =>
      current.map((service) => {
        if (service.id !== serviceId) return service

        if (field === 'price' || field === 'duration') {
          const numericValue = Number(value)
          return {
            ...service,
            [field]: Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0
          }
        }

        return {
          ...service,
          [field]: value
        }
      })
    )
    setAdminFeedback('Servicos atualizados.')
  }

  const handleDeleteService = (serviceId) => {
    setServices((current) => current.filter((service) => service.id !== serviceId))
    setAdminFeedback('Servico removido.')
  }

  const handleNewServiceChange = (event) => {
    const { name, value } = event.target
    setNewService((current) => ({ ...current, [name]: value }))
  }

  const handleCreateService = (event) => {
    event.preventDefault()

    const name = newService.name.trim()
    const price = Number(newService.price)
    const duration = Number(newService.duration)

    if (!name) {
      setAdminFeedback('Informe o nome do servico.')
      return
    }

    if (!Number.isFinite(price) || price <= 0) {
      setAdminFeedback('Informe um preco valido maior que zero.')
      return
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      setAdminFeedback('Informe uma duracao valida em minutos.')
      return
    }

    const idBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const id = `${idBase}-${Date.now()}`

    setServices((current) => [
      ...current,
      {
        id,
        name,
        price,
        duration
      }
    ])

    setNewService({
      name: '',
      price: '',
      duration: ''
    })
    setAdminFeedback('Servico cadastrado com sucesso.')
  }

  const handleAdminLogin = (event) => {
    event.preventDefault()

    const now = Date.now()
    const lockTimestamp = adminLockUntil ? Date.parse(adminLockUntil) : NaN

    if (Number.isFinite(lockTimestamp) && lockTimestamp > now) {
      const remainingMs = lockTimestamp - now
      const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000))
      setAdminAuthError(`Acesso temporariamente bloqueado. Tente novamente em ${remainingMin} min.`)
      return
    }

    if (adminPassword.trim() !== adminPin) {
      const nextAttempts = adminAttemptsLeft - 1

      if (nextAttempts <= 0) {
        const lockUntil = new Date(now + ADMIN_LOCK_MINUTES * 60000).toISOString()
        setAdminLockUntil(lockUntil)
        setAdminAttemptsLeft(MAX_ADMIN_ATTEMPTS)
        setAdminAuthError(`Muitas tentativas. Acesso bloqueado por ${ADMIN_LOCK_MINUTES} minutos.`)
        return
      }

      setAdminAttemptsLeft(nextAttempts)
      setAdminAuthError(`Senha incorreta. Tentativas restantes: ${nextAttempts}.`)
      return
    }

    setIsAdminUnlocked(true)
    setAdminPassword('')
    setAdminAuthError('')
    setAdminAttemptsLeft(MAX_ADMIN_ATTEMPTS)
    setAdminLockUntil('')
    setAdminFeedback('Acesso admin liberado.')
  }

  const handleAdminLogout = () => {
    setIsAdminUnlocked(false)
    setAdminPassword('')
    setAdminAuthError('')
    setViewMode('cliente')
  }

  const handleChangeAdminPin = (event) => {
    event.preventDefault()

    if (currentPinInput !== adminPin) {
      setAdminFeedback('PIN atual incorreto.')
      return
    }

    if (newPinInput.length < 6) {
      setAdminFeedback('Novo PIN deve ter pelo menos 6 caracteres.')
      return
    }

    if (newPinInput !== confirmNewPinInput) {
      setAdminFeedback('A confirmacao do novo PIN nao confere.')
      return
    }

    setAdminPin(newPinInput)
    setCurrentPinInput('')
    setNewPinInput('')
    setConfirmNewPinInput('')
    setAdminFeedback('PIN do admin atualizado com sucesso.')
  }

  const handleClearAllData = async () => {
    const confirmMessage =
      'Tem certeza que deseja limpar TODOS os servicos e TODOS os agendamentos? Essa acao nao pode ser desfeita.'

    if (!window.confirm(confirmMessage)) {
      return
    }

    setServices(initialServices)
    setAppointments([])
    setSelectedServices([])
    if (!isSupabaseConfigured) {
      localStorage.removeItem(APPOINTMENTS_STORAGE_KEY)
    }

    setFeedback('')
    setAdminFeedback(
      isSupabaseConfigured
        ? 'Servicos locais limpos. Agendamentos online nao foram apagados por seguranca.'
        : 'Dados locais limpos. Servicos voltaram para o padrao inicial.'
    )
  }

  const handleUpdateAppointmentStatus = async (appointmentId, nextStatus) => {
    if (!isAdminUnlocked) {
      setAdminFeedback('Apenas o admin pode alterar status.')
      return
    }

    setAppointments((current) =>
      current.map((appointment) =>
        appointment.id === appointmentId ? { ...appointment, status: nextStatus } : appointment
      )
    )

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('appointments')
        .update({ status: nextStatus })
        .eq('id', appointmentId)

      if (error) {
        setAdminFeedback('Falha ao atualizar status online. Tente novamente.')
        return
      }
    }

    setAdminFeedback('Status do agendamento atualizado.')
  }

  const handleExportToWhatsApp = () => {
    setFeedback('Conclua seu agendamento enviando a mensagem no WhatsApp.')
    const message = buildAppointmentsMessage(filteredAppointments)
    const whatsappUrl = `https://wa.me/${SALON_WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  }

  const handleExportToPdf = () => {
    const message = buildAppointmentsMessage(filteredAppointments)
    const printWindow = window.open('', '_blank', 'noopener,noreferrer')

    if (!printWindow) {
      setFeedback('Nao foi possivel abrir a janela de impressao. Verifique bloqueio de pop-up.')
      return
    }

    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Agenda - Studio Lucia Soares</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
            h1 { margin: 0 0 12px; }
            pre { white-space: pre-wrap; font-size: 14px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <h1>Agenda Studio Lucia Soares</h1>
          <pre>${message.replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]))}</pre>
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.clientName || !formData.phone || !formData.date || !formData.time) {
      setFeedback('Preencha nome, telefone, data e horario.')
      return
    }

    if (selectedServiceData.length === 0) {
      setFeedback('Selecione ao menos um servico para agendar.')
      return
    }

    setIsSubmitting(true)

    const appointment = {
      id: crypto.randomUUID(),
      clientName: formData.clientName,
      phone: formData.phone,
      date: formData.date,
      time: formData.time,
      notes: formData.notes,
      services: selectedServiceData.map((service) => service.name),
      totalPrice,
      totalDuration,
      status: APPOINTMENT_STATUS.PENDING
    }

    if (isSupabaseConfigured && supabase) {
      const payload = {
        id: appointment.id,
        client_name: appointment.clientName,
        phone: appointment.phone,
        date: appointment.date,
        time: appointment.time,
        notes: appointment.notes,
        services: appointment.services,
        total_price: appointment.totalPrice,
        total_duration: appointment.totalDuration,
        status: appointment.status
      }

      const { data, error } = await supabase
        .from('appointments')
        .insert(payload)
        .select('*')
        .single()

      if (error) {
        setAppointments((current) => [appointment, ...current])
        setFeedback('Falha ao sincronizar online. Agendamento salvo apenas neste dispositivo.')
      } else if (data) {
        setAppointments((current) => [mapDatabaseAppointment(data), ...current])
        setFeedback('Agendamento criado e sincronizado com sucesso!')
      }
    } else {
      setAppointments((current) => [appointment, ...current])
      setFeedback('Agendamento criado com sucesso!')
    }

    setFormData({
      clientName: '',
      phone: '',
      date: getTodayDate(),
      time: '',
      notes: ''
    })
    setSelectedServices([])
    setIsSubmitting(false)
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="tag">Agenda Virtual</p>
        <h1>Studio Lucia Soares</h1>
        <p>
          Escolha os servicos, veja os valores e agende seu horario em poucos minutos.
        </p>
        <p className="hint">
          {isSupabaseConfigured
            ? 'Sincronizacao online ativa: agendamentos aparecem em todos os dispositivos.'
            : 'Sincronizacao online desativada: os dados ficam apenas neste dispositivo.'}
        </p>

        <div className="mode-switch" role="tablist" aria-label="Troca de modo">
          <button
            type="button"
            className={viewMode === 'cliente' ? 'active' : ''}
            onClick={() => setViewMode('cliente')}
          >
            Modo Cliente
          </button>
          <button
            type="button"
            className={viewMode === 'admin' ? 'active' : ''}
            onClick={() => setViewMode('admin')}
          >
            Modo Admin
          </button>
        </div>
      </header>

      {viewMode === 'cliente' ? (
        <main className="layout">
          <section className="card">
            <div className="section-header">
              <h2>Servicos Disponiveis</h2>
              <span>{selectedServices.length} selecionado(s)</span>
            </div>

            <div className="service-grid">
              {services.map((service) => {
                const selected = selectedServices.includes(service.id)
                return (
                  <button
                    key={service.id}
                    type="button"
                    className={`service-card ${selected ? 'selected' : ''}`}
                    onClick={() => handleSelectService(service.id)}
                  >
                    <strong>{service.name}</strong>
                    <p>{formatCurrency(service.price)}</p>
                    <small>{service.duration} min</small>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="card">
            <div className="section-header">
              <h2>Agendar Horario</h2>
              <span>Cliente</span>
            </div>

            <form className="booking-form" onSubmit={handleSubmit}>
              <label>
                Nome completo
                <input
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleInputChange}
                  placeholder="Ex: Maria Oliveira"
                />
              </label>

              <label>
                Telefone
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(11) 99999-9999"
                />
              </label>

              <div className="two-columns">
                <label>
                  Data
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    min={getTodayDate()}
                  />
                </label>

                <label>
                  Horario
                  <select name="time" value={formData.time} onChange={handleInputChange}>
                    <option value="">Selecione</option>
                    {availableSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Observacoes
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Preferencias, alergias ou detalhes importantes"
                  rows={3}
                />
              </label>

              <div className="summary">
                <p>Total: <strong>{formatCurrency(totalPrice)}</strong></p>
                <p>Tempo estimado: <strong>{totalDuration || 0} min</strong></p>
              </div>

              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Confirmar agendamento'}
              </button>

              {feedback ? <p className="feedback">{feedback}</p> : null}
            </form>
          </section>

          <section className="card full-width">
            <div className="section-header">
              <h2>Agendamentos</h2>
              <span>Painel rapido</span>
            </div>

            <div className="toolbar-row">
              <label className="filter-label">
                Filtrar por data
                <input
                  type="date"
                  value={appointmentFilterDate}
                  onChange={(event) => setAppointmentFilterDate(event.target.value)}
                />
              </label>

              <div className="toolbar-actions">
                <button type="button" className="secondary-button" onClick={handleExportToPdf}>
                  Exportar PDF
                </button>
                <button type="button" className="secondary-button" onClick={handleExportToWhatsApp}>
                  Concluir
                </button>
              </div>
            </div>

            <p className="hint">Conclua seu agendamento enviando a mensagem no WhatsApp.</p>

            {isSyncLoading ? <p className="hint">Carregando agendamentos sincronizados...</p> : null}

            {filteredAppointments.length === 0 ? (
              <p className="empty-state">Nenhum agendamento ainda.</p>
            ) : (
              <ul className="appointment-list">
                {filteredAppointments.map((appointment) => (
                  <li key={appointment.id}>
                    <div>
                      <strong>{appointment.clientName}</strong>
                      <p>{appointment.date} as {appointment.time}</p>
                      <small>{appointment.services.join(' + ')}</small>
                      <p>
                        <span className={`status-badge status-${appointment.status || APPOINTMENT_STATUS.PENDING}`}>
                          {appointment.status || APPOINTMENT_STATUS.PENDING}
                        </span>
                      </p>
                    </div>
                    <div className="appointment-meta">
                      <p>{formatCurrency(appointment.totalPrice)}</p>
                      <small>{appointment.totalDuration} min</small>
                      {isAdminUnlocked ? (
                        <select
                          className="status-select"
                          value={appointment.status || APPOINTMENT_STATUS.PENDING}
                          onChange={(event) => handleUpdateAppointmentStatus(appointment.id, event.target.value)}
                        >
                          <option value={APPOINTMENT_STATUS.PENDING}>pendente</option>
                          <option value={APPOINTMENT_STATUS.CONFIRMED}>confirmado</option>
                          <option value={APPOINTMENT_STATUS.CANCELED}>cancelado</option>
                        </select>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      ) : (
        <main className="layout admin-layout">
          {!isAdminUnlocked ? (
            <section className="card admin-auth-card">
              <div className="section-header">
                <h2>Acesso Admin</h2>
                <span>Protegido</span>
              </div>

              <form className="booking-form" onSubmit={handleAdminLogin}>
                <label>
                  Senha do painel
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    placeholder="Digite a senha"
                  />
                </label>

                <button className="primary-button" type="submit">
                  Entrar no Admin
                </button>

                <p className="hint">Apos entrar, troque o PIN para um codigo com 6+ caracteres.</p>
                {adminAuthError ? <p className="feedback">{adminAuthError}</p> : null}
              </form>
            </section>
          ) : null}

          {isAdminUnlocked ? (
            <>
          <section className="card">
            <div className="section-header">
              <h2>Cadastrar novo servico</h2>
              <div className="admin-header-actions">
                <span>Admin</span>
                <button className="secondary-button" type="button" onClick={handleAdminLogout}>
                  Sair do Admin
                </button>
              </div>
            </div>

            <form className="booking-form" onSubmit={handleCreateService}>
              <label>
                Nome do servico
                <input
                  name="name"
                  value={newService.name}
                  onChange={handleNewServiceChange}
                  placeholder="Ex: Botox capilar"
                />
              </label>

              <div className="two-columns">
                <label>
                  Preco (R$)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="price"
                    value={newService.price}
                    onChange={handleNewServiceChange}
                    placeholder="0,00"
                  />
                </label>

                <label>
                  Duracao (min)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    name="duration"
                    value={newService.duration}
                    onChange={handleNewServiceChange}
                    placeholder="60"
                  />
                </label>
              </div>

              <button className="primary-button" type="submit">
                Cadastrar servico
              </button>

              {adminFeedback ? <p className="feedback">{adminFeedback}</p> : null}

              <button className="danger-button" type="button" onClick={handleClearAllData}>
                Limpar servicos e agendamentos
              </button>
            </form>
          </section>

          <section className="card full-width">
            <div className="section-header">
              <h2>Gerenciar servicos</h2>
              <span>{services.length} cadastrado(s)</span>
            </div>

            <form className="booking-form admin-pin-form" onSubmit={handleChangeAdminPin}>
              <h3>Seguranca do Admin</h3>
              <label>
                PIN atual
                <input
                  type="password"
                  value={currentPinInput}
                  onChange={(event) => setCurrentPinInput(event.target.value)}
                  placeholder="Digite o PIN atual"
                />
              </label>

              <div className="two-columns">
                <label>
                  Novo PIN
                  <input
                    type="password"
                    value={newPinInput}
                    onChange={(event) => setNewPinInput(event.target.value)}
                    placeholder="Minimo 6 caracteres"
                  />
                </label>

                <label>
                  Confirmar novo PIN
                  <input
                    type="password"
                    value={confirmNewPinInput}
                    onChange={(event) => setConfirmNewPinInput(event.target.value)}
                    placeholder="Repita o novo PIN"
                  />
                </label>
              </div>

              <button className="secondary-button" type="submit">
                Atualizar PIN
              </button>
            </form>

            {services.length === 0 ? (
              <p className="empty-state">Nenhum servico cadastrado.</p>
            ) : (
              <ul className="admin-service-list">
                {services.map((service) => (
                  <li key={service.id}>
                    <div className="admin-service-grid">
                      <label>
                        Nome
                        <input
                          value={service.name}
                          onChange={(event) => handleServiceFieldChange(service.id, 'name', event.target.value)}
                        />
                      </label>

                      <label>
                        Preco (R$)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={service.price}
                          onChange={(event) => handleServiceFieldChange(service.id, 'price', event.target.value)}
                        />
                      </label>

                      <label>
                        Duracao (min)
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={service.duration}
                          onChange={(event) => handleServiceFieldChange(service.id, 'duration', event.target.value)}
                        />
                      </label>
                    </div>

                    <div className="admin-service-actions">
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => handleDeleteService(service.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
            </>
          ) : null}
        </main>
      )}
    </div>
  )
}

export default App
