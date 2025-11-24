import React, { useState, useEffect, useRef } from "react";
import {
  FaExclamationTriangle,
  FaWallet,
  FaCheckCircle,
  FaInfoCircle,
  FaTimesCircle,
} from "react-icons/fa";
import "./RecargaWidget.css";

const EMPRESA_RIF = "J123456789";
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api'; // Adjust as needed

const RecargaWidget = () => {
  const [monto, setMonto] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const modalRef = useRef(null);
  const errorModalRef = useRef(null);

  const mensajes = monto * 10;

  useEffect(() => {
    if (showModal && modalRef.current) {
      modalRef.current.showModal();
    } else if (!showModal && modalRef.current?.open) {
      modalRef.current.close();
    }
  }, [showModal]);

  useEffect(() => {
    if (showErrorModal && errorModalRef.current) {
      errorModalRef.current.showModal();
    } else if (!showErrorModal && errorModalRef.current?.open) {
      errorModalRef.current.close();
    }
  }, [showErrorModal]);

  // Check for PayPal return
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const token = queryParams.get('token');

    if (token) {
      setLoading(true);
      // Clear the token from URL to prevent re-processing on refresh
      window.history.replaceState({}, document.title, window.location.pathname);

      fetch(`${API_URL}/capture-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          empresa_rif: EMPRESA_RIF
        }),
      })
        .then(async res => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Error desconocido al procesar el pago.');
          }
          return data;
        })
        .then(data => {
          if (data.status === 'COMPLETED') {
            setShowModal(true);
          } else {
            setErrorMessage(`El pago no se pudo completar. Estado: ${data.status}`);
            setShowErrorModal(true);
          }
        })
        .catch(err => {
          console.error('Error capturing order:', err);
          setErrorMessage(err.message || 'Ocurrió un error al procesar el pago.');
          setShowErrorModal(true);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, []);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monto: monto.toString(),
          empresa_rif: EMPRESA_RIF,
          return_url: window.location.href, // Return to current page
          cancel_url: window.location.href  // Return to current page on cancel
        }),
      });

      const data = await res.json();

      if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
      } else {
        setErrorMessage('No se pudo iniciar el pago con PayPal.');
        setShowErrorModal(true);
      }
    } catch (err) {
      console.error('Error creating order:', err);
      setErrorMessage('Ocurrió un error al iniciar el pago. Por favor revisa tu conexión.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="container-custom">
        <div className="card-recarga">
          <h4 className="titulo">💬 Recargar Mensajes WhatsApp</h4>

          <div className="alerta">
            <FaExclamationTriangle className="icon-left" />
            <p className="texto-moneda">
              Este servicio se cobra exclusivamente en <strong>dólares estadounidenses (USD)</strong> porque los mensajes de WhatsApp Business son facturados en moneda internacional.
            </p>
          </div>

          {/* Slider */}
          <div className="slider">
            <label className="label-form">Selecciona cuánto deseas recargar:</label>

            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={monto}
              onChange={(e) => setMonto(parseInt(e.target.value))}
            />

            <div className="d-flex-space mt-1">
              <span>$5</span>
              <span>$100</span>
            </div>
          </div>

          {/* Resumen */}
          <div className="resumen-box">
            <div className="resumen-flex">
              <FaWallet className="icon-wallet" />
              <div>
                <div className="valor-recarga">
                  ${monto} USD por {mensajes} mensajes
                </div>
                <div className="texto-explicativo">
                  Tu saldo se acreditará inmediatamente y se mantendrá disponible
                  hasta que lo consumas.
                </div>
              </div>
            </div>
          </div>

          {/* Formulario mock */}
          <div className="payment-form">
            <label className="label-form">Nombre en la tarjeta</label>
            <input
              className="form-control"
              placeholder="Ej. Juan Pérez"
            />

            <label className="label-form">Número de tarjeta</label>
            <input
              className="form-control"
              placeholder="•••• •••• •••• ••••"
            />

            <div className="form-row">
              <div className="col-custom">
                <label className="label-form">Vencimiento</label>
                <input className="form-control" placeholder="MM/AA" />
              </div>

              <div className="col-custom">
                <label className="label-form">CVV</label>
                <input className="form-control" placeholder="123" />
              </div>
            </div>
          </div>

          <div className="text-end">
            <button
              className="btn-pago"
              onClick={handlePayment}
              disabled={loading}
            >
              {loading ? 'Procesando...' : '💳 Pagar ahora'}
            </button>
          </div>

          <div className="paypal-section">
            <label className="label-form">
              O paga de forma segura con PayPal
            </label>
            {/* Native button replaced the SDK container */}
            <button
              className="btn-paypal"
              onClick={handlePayment}
              disabled={loading}
              style={{
                backgroundColor: '#ffc439',
                color: '#000',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                fontWeight: 'bold',
                width: '100%',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              {loading ? 'Cargando...' : 'Pagar con PayPal'}
            </button>
          </div>

          {/* Condiciones */}
          <div className="condiciones">
            <p>
              <FaInfoCircle className="icon-left icon-verde" />
              Los mensajes se acreditan en tu cuenta inmediatamente después del pago.
            </p>
            <p>
              <FaInfoCircle className="icon-left icon-verde" />
              Los mensajes <strong>no caducan</strong>, se mantienen hasta que los uses.
            </p>
            <p>
              <FaInfoCircle className="icon-left icon-verde" />
              No se realizan reembolsos por recargas ya procesadas.
            </p>
            <p>
              <FaInfoCircle className="icon-left icon-verde" />
              Desde la <strong>bandeja de envío</strong> podrás usarlos manual o automáticamente.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Exito */}
      <dialog ref={modalRef} className="modal-custom">
        <div className="modal-header">
          <h5 className="modal-title text-success">
            <FaCheckCircle className="icon-exito" /> Pago exitoso
          </h5>
          <button className="btn-close" onClick={() => setShowModal(false)}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <p>Tu recarga se procesó correctamente.</p>
          <p>
            <strong>Monto pagado:</strong> ${monto} USD
          </p>
          <p>
            <strong>Mensajes acreditados:</strong> {mensajes} mensajes
          </p>
          <p>
            Ya puedes comenzar a enviar tus notificaciones desde la bandeja de
            WhatsApp.
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn-success" onClick={() => setShowModal(false)}>
            Aceptar
          </button>
        </div>
      </dialog>

      {/* Modal Error */}
      <dialog ref={errorModalRef} className="modal-custom">
        <div className="modal-header">
          <h5 className="modal-title text-danger" style={{ color: '#dc3545' }}>
            <FaTimesCircle className="icon-exito" style={{ color: '#dc3545' }} /> Error en el pago
          </h5>
          <button className="btn-close" onClick={() => setShowErrorModal(false)}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <p>{errorMessage}</p>
          <p>
            Por favor, intenta nuevamente o contacta a soporte si el problema persiste.
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn-danger" style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px' }} onClick={() => setShowErrorModal(false)}>
            Cerrar
          </button>
        </div>
      </dialog>
    </>
  );
};

export default RecargaWidget;
