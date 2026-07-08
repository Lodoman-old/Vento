import { validationResult, body } from "express-validator";

export function handleErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Datos inválidos",
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// Reglas de validación por ruta
export const eventRules = [
  body("name").trim().notEmpty().withMessage("El nombre es obligatorio"),
  body("date").isISO8601().withMessage("Fecha inválida"),
  body("totalBudget").optional().isFloat({ min: 0 }).withMessage("Presupuesto inválido"),
  handleErrors,
];

export const agendaRules = [
  body("eventId").notEmpty().withMessage("eventId es obligatorio"),
  body("title").trim().notEmpty().withMessage("El título es obligatorio"),
  body("startTime").isISO8601().withMessage("startTime inválido"),
  handleErrors,
];

export const supplierRules = [
  body("eventId").notEmpty().withMessage("eventId es obligatorio"),
  body("name").trim().notEmpty().withMessage("El nombre es obligatorio"),
  handleErrors,
];

export const quoteRules = [
  body("eventId").notEmpty().withMessage("eventId es obligatorio"),
  body("items").isArray({ min: 1 }).withMessage("Debe incluir al menos un item"),
  body("items.*.itemName").trim().notEmpty().withMessage("Nombre de item obligatorio"),
  body("items.*.quantity").isInt({ min: 1 }).withMessage("Cantidad debe ser >= 1"),
  body("items.*.unitPrice").isFloat({ min: 0 }).withMessage("Precio inválido"),
  handleErrors,
];

export const quoteUpdateRules = [
  body("items").isArray({ min: 1 }).withMessage("Debe incluir al menos un item"),
  body("items.*.itemName").trim().notEmpty().withMessage("Nombre de item obligatorio"),
  body("items.*.quantity").isInt({ min: 1 }).withMessage("Cantidad debe ser >= 1"),
  body("items.*.unitPrice").isFloat({ min: 0 }).withMessage("Precio inválido"),
  handleErrors,
];

export const authRules = [
  body("email").isEmail().withMessage("Email inválido"),
  body("password").isLength({ min: 6 }).withMessage("Mínimo 6 caracteres"),
  handleErrors,
];

export const catalogRules = [
  body("name").trim().notEmpty().withMessage("El nombre es obligatorio"),
  body("category").trim().notEmpty().withMessage("La categoría es obligatoria"),
  body("unitPrice").isFloat({ min: 0 }).withMessage("Precio inválido"),
  handleErrors,
];

export const patchAgendaRules = [
  body("isCompleted").optional().isBoolean().withMessage("isCompleted debe ser booleano"),
  handleErrors,
];
