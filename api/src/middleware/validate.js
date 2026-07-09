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
function orBody(...fields) {
  return fields.map((f) => body(f));
}

export const eventRules = [
  body("name").trim().notEmpty().withMessage("El nombre es obligatorio"),
  body("date").isISO8601().withMessage("Fecha inválida"),
  body("total_budget").optional().isFloat({ min: 0 }).withMessage("Presupuesto inválido"),
  body("totalBudget").optional().isFloat({ min: 0 }).withMessage("Presupuesto inválido"),
  handleErrors,
];

export const agendaRules = [
  body("event_id").optional().notEmpty(),
  body("eventId").optional().notEmpty(),
  body("title").trim().notEmpty().withMessage("El título es obligatorio"),
  body("start_time").optional().isISO8601(),
  body("startTime").optional().isISO8601(),
  handleErrors,
];

export const supplierRules = [
  body("event_id").optional().notEmpty(),
  body("eventId").optional().notEmpty(),
  body("name").trim().notEmpty().withMessage("El nombre es obligatorio"),
  handleErrors,
];

export const quoteRules = [
  body("event_id").optional().notEmpty(),
  body("eventId").optional().notEmpty(),
  body("items").isArray({ min: 1 }).withMessage("Debe incluir al menos un item"),
  body("items.*.item_name").optional().trim().notEmpty(),
  body("items.*.itemName").optional().trim().notEmpty(),
  body("items.*.quantity").isInt({ min: 1 }).withMessage("Cantidad debe ser >= 1"),
  body("items.*.unit_price").optional().isFloat({ min: 0 }),
  body("items.*.unitPrice").optional().isFloat({ min: 0 }),
  handleErrors,
];

export const quoteUpdateRules = [
  body("items").isArray({ min: 1 }).withMessage("Debe incluir al menos un item"),
  body("items.*.item_name").optional().trim().notEmpty(),
  body("items.*.itemName").optional().trim().notEmpty(),
  body("items.*.quantity").isInt({ min: 1 }).withMessage("Cantidad debe ser >= 1"),
  body("items.*.unit_price").optional().isFloat({ min: 0 }),
  body("items.*.unitPrice").optional().isFloat({ min: 0 }),
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
  body("unit_price").optional().isFloat({ min: 0 }),
  body("unitPrice").optional().isFloat({ min: 0 }),
  handleErrors,
];

export const patchAgendaRules = [
  body("is_completed").optional().isBoolean().withMessage("is_completed debe ser booleano"),
  body("isCompleted").optional().isBoolean().withMessage("isCompleted debe ser booleano"),
  handleErrors,
];
