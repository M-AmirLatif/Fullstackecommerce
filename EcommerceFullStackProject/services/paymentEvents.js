const Order = require('../models/order')

const applyPaymentEvent = async ({ orderId, eventType, transactionId = '' }) => {
  const order = await Order.findById(orderId)
  if (!order) return { ok: false, reason: 'ORDER_NOT_FOUND' }

  if (eventType === 'payment.succeeded') {
    if (order.payment?.status === 'succeeded') return { ok: true, order, duplicate: true }
    order.payment = {
      provider: order.payment?.provider || 'demo',
      status: 'succeeded',
      transactionId: transactionId || order.payment?.transactionId || '',
    }
    order.status = 'Paid'
    order.paidAt = new Date()
    await order.save()
    return { ok: true, order }
  }

  if (eventType === 'payment.failed') {
    order.payment = {
      provider: order.payment?.provider || 'demo',
      status: 'failed',
      transactionId: transactionId || order.payment?.transactionId || '',
    }
    order.status = 'Pending'
    await order.save()
    return { ok: true, order }
  }

  if (eventType === 'payment.refunded') {
    order.payment = {
      provider: order.payment?.provider || 'demo',
      status: 'refunded',
      transactionId: transactionId || order.payment?.transactionId || '',
    }
    order.status = 'Cancelled'
    await order.save()
    return { ok: true, order }
  }

  return { ok: false, reason: 'UNKNOWN_EVENT' }
}

module.exports = { applyPaymentEvent }
