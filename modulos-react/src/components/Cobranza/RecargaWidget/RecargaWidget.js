import React, { useState, useEffect, useRef } from "react";
import {
  FaExclamationTriangle,
  FaWallet,
  FaCheckCircle,
  FaInfoCircle,
} from "react-icons/fa";
import "./RecargaWidget.css";

const RecargaWidget = () => {
  const [monto, setMonto] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const modalRef = useRef(null);

  const mensajes = monto * 10;

  useEffect(() => {
    if (showModal && modalRef.current) {
      modalRef.current.showModal();
    } else if (!showModal && modalRef.current?.open) {
      modalRef.current.close();
    }
  }, [showModal]);

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
            <button className="btn-pago" onClick={() => setShowModal(true)}>
              💳 Pagar ahora
            </button>
          </div>

          {/* Condiciones */}
          <div className="condiciones">
            <p>
              <FaInfoCircle  className="icon-left icon-verde"/>
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

      {/* Modal nativo */}
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
    </>
  );
};

export default RecargaWidget;
