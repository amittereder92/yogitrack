// 1) Load env vars first - MUST be before anything else
require("dotenv").config();

const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/* -------------------- MongoDB Connection -------------------- */
mongoose
  .connect(process.env.MONGODB_URI, { autoIndex: true })
  .then(async () => {
    console.log("✅ MongoDB connected");
    await Promise.all([
      Instructor.ensureIndexes(),
      ClassSession.ensureIndexes(),
      Package.ensureIndexes(),
      Customer.ensureIndexes(),
      Sale.ensureIndexes(),
      Attendance.ensureIndexes(),
    ]);
    console.log("✅ MongoDB indexes ensured");
    /* -------------------- Start Server -------------------- */
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });

    
  })
  .catch((err) => console.log("❌ MongoDB connection error:", err));

/* -------------------- Helpers -------------------- */
function pad(num, size = 5) {
  return String(num).padStart(size, "0");
}

function requireFields(obj, fields) {
  const missing = [];
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null || String(obj[f]).trim() === "")
      missing.push(f);
  }
  return missing;
}

// UC1 & UC4: Welcome message for instructor and customer
function buildWelcomeMessage(type, firstName, id) {
  return `Welcome to Yoga'Hom! ${firstName}... Your ${type} id is ${id}.`;
}

// UC5 (Attendance): Check-in confirmation message
function buildCheckinMessage(firstName, occurredAt, classBalance) {
  const d = new Date(occurredAt);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  return `Hello ${firstName}! You are checked-in for a class on ${dd}/${mm}/${yy} at ${hours}:${minutes} ${ampm}. Your class-balance is ${classBalance}.`;
}

// Simulated send (replace with real email/SMS provider as needed)
function sendMessage(channel, contact, message) {
  console.log(`[SEND ${channel.toUpperCase()}] -> ${contact} | ${message}`);
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/* -------------------- Schemas / Models -------------------- */

// Counter for ID generation
const CounterSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);
const Counter = mongoose.model("Counter", CounterSchema);

async function nextId(prefix, key) {
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}${pad(doc.seq)}`;
}

/* ---- Instructors (Use Case 1) ---- */
const InstructorSchema = new mongoose.Schema(
  {
    instructorId: { type: String, unique: true, required: true }, // unique already creates index
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    preferredComm: { type: String, enum: ["phone", "email"], required: true },
  },
  { timestamps: true }
);
// ✅ Only non-duplicate indexes
InstructorSchema.index({ firstName: 1, lastName: 1 });
InstructorSchema.index({ createdAt: -1 });
const Instructor = mongoose.model("Instructor", InstructorSchema);

/* ---- Class Schedule (Use Case 2) ---- */
const ClassSessionSchema = new mongoose.Schema(
  {
    classId: { type: String, unique: true, required: true }, // unique already creates index
    instructorId: { type: String, required: true },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    timeHHmm: { type: String, required: true },
    classType: { type: String, enum: ["General", "Special"], required: true },
    payRate: { type: Number, required: true },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);
// ✅ Only non-duplicate indexes
ClassSessionSchema.index({ instructorId: 1, createdAt: -1 });
ClassSessionSchema.index({ dayOfWeek: 1, timeHHmm: 1 });
const ClassSession = mongoose.model("ClassSession", ClassSessionSchema);

/* ---- Packages (Use Case 3) ---- */
const PackageSchema = new mongoose.Schema(
  {
    packageId: { type: String, unique: true, required: true }, // unique already creates index
    packageName: { type: String, required: true, trim: true },
    packageCategory: { type: String, enum: ["General", "Senior"], required: true },
    numberOfClasses: {
      type: String,
      enum: ["1", "4", "10", "unlimited"],
      required: true,
    },
    classType: { type: String, enum: ["General", "Special"], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    price: { type: Number, required: true },
  },
  { timestamps: true }
);
// ✅ Only non-duplicate indexes
PackageSchema.index({ packageCategory: 1, classType: 1 });
PackageSchema.index({ startDate: 1, endDate: 1 });
const Package = mongoose.model("Package", PackageSchema);

/* ---- Customers (Use Case 4) ---- */
const CustomerSchema = new mongoose.Schema(
  {
    customerId: { type: String, unique: true, required: true }, // unique already creates index
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    preferredComm: { type: String, enum: ["phone", "email"], required: true },
    classBalance: { type: Number, default: 0 },
  },
  { timestamps: true }
);
// ✅ Only non-duplicate indexes
CustomerSchema.index({ lastName: 1, firstName: 1 });
const Customer = mongoose.model("Customer", CustomerSchema);

/* ---- Sales (Use Case 5) ---- */
const SaleSchema = new mongoose.Schema(
  {
    saleId: { type: String, unique: true, required: true }, // unique already creates index
    customerId: { type: String, required: true },
    packageId: { type: String, required: true },
    amountPaid: { type: Number, required: true },
    paymentMode: {
      type: String,
      enum: ["cash", "card", "online"],
      required: true,
    },
    paidAt: { type: Date, required: true },
    validityStart: { type: Date, required: true },
    validityEnd: { type: Date, required: true },
  },
  { timestamps: true }
);
// ✅ Only non-duplicate indexes
SaleSchema.index({ customerId: 1, paidAt: -1 });
SaleSchema.index({ packageId: 1, paidAt: -1 });
const Sale = mongoose.model("Sale", SaleSchema);

/* ---- Attendance (Use Case 6) ---- */
const AttendanceSchema = new mongoose.Schema(
  {
    attendanceId: { type: String, unique: true, required: true }, // unique already creates index
    instructorId: { type: String, required: true },
    classId: { type: String, required: true },
    occurredAt: { type: Date, required: true },
    customerIds: [{ type: String }],
    warning: { type: String, default: "" },
    allowNegative: { type: Boolean, default: false },
  },
  { timestamps: true }
);
// ✅ Only non-duplicate indexes
AttendanceSchema.index({ instructorId: 1, classId: 1, occurredAt: -1 });
AttendanceSchema.index({ occurredAt: -1 });
const Attendance = mongoose.model("Attendance", AttendanceSchema);


/* ==========================================
   ROUTES
   ========================================== */

app.get("/", (req, res) => {
  res.send("YogiTrack (Yoga'Hom) API is running ✅");
});

/* ===========================================
   USE CASE 1: Instructor Management
   =========================================== */

// Add instructor
app.post(
  "/api/instructors",
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    // UC1: Step 1 - check name first (before generating ID)
    const nameMissing = requireFields(body, ["firstName", "lastName"]);
    if (nameMissing.length)
      return res
        .status(400)
        .json({ error: "Missing required fields", missing: nameMissing });

    const fName = body.firstName.trim();
    const lName = body.lastName.trim();

    // UC1: Step 2 - check if instructor name already exists
    const existing = await Instructor.find({
      firstName: fName,
      lastName: lName,
    }).limit(5);

    // UC1: Step 3 - prompt to confirm if duplicate exists
    if (existing.length > 0 && body.confirmDuplicate !== true) {
      return res.status(409).json({
        error: "Instructor name already exists",
        message: "Re-submit with confirmDuplicate: true to proceed.",
        existing: existing.map((x) => ({
          instructorId: x.instructorId,
          firstName: x.firstName,
          lastName: x.lastName,
        })),
      });
    }

    // UC1: Step 4 - validate ALL required fields before generating ID
    const allMissing = requireFields(body, [
      "firstName",
      "lastName",
      "preferredComm",
    ]);
    if (allMissing.length)
      return res
        .status(400)
        .json({ error: "Missing required fields", missing: allMissing });

    if (!["phone", "email"].includes(body.preferredComm)) {
      return res.status(400).json({
        error: "preferredComm must be 'phone' or 'email'",
      });
    }

    // UC1: Step 5 - generate instructor ID with I prefix
    const instructorId = await nextId("I", "instructor");

    // UC1: Step 6 - save record
    const created = await Instructor.create({
      instructorId,
      firstName: fName,
      lastName: lName,
      address: body.address || "",
      phone: body.phone || "",
      email: body.email || "",
      preferredComm: body.preferredComm,
    });

    // UC1: Step 7 - confirm record saved + send welcome message
    const msg = buildWelcomeMessage(
      "instructor",
      created.firstName,
      created.instructorId
    );
    const contact =
      created.preferredComm === "email" ? created.email : created.phone;
    sendMessage(created.preferredComm, contact, msg);

    res.status(201).json({
      message: "Instructor record saved successfully.",
      instructor: created,
      confirmationMessage: msg,
    });
  })
);

// Get all instructors
app.get(
  "/api/instructors",
  asyncHandler(async (req, res) => {
    const instructors = await Instructor.find().sort({ createdAt: -1 });
    res.json(instructors);
  })
);

// Get single instructor
app.get(
  "/api/instructors/:id",
  asyncHandler(async (req, res) => {
    const instructor = await Instructor.findOne({
      instructorId: req.params.id,
    });
    if (!instructor)
      return res.status(404).json({ error: "Instructor not found" });
    res.json(instructor);
  })
);

// Update instructor
app.put(
  "/api/instructors/:id",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const updated = await Instructor.findOneAndUpdate(
      { instructorId: req.params.id },
      {
        $set: {
          ...(body.firstName && { firstName: body.firstName.trim() }),
          ...(body.lastName && { lastName: body.lastName.trim() }),
          ...(body.address !== undefined && { address: body.address }),
          ...(body.phone !== undefined && { phone: body.phone }),
          ...(body.email !== undefined && { email: body.email }),
          ...(body.preferredComm && { preferredComm: body.preferredComm }),
        },
      },
      { new: true }
    );
    if (!updated)
      return res.status(404).json({ error: "Instructor not found" });
    res.json({ instructor: updated });
  })
);

/* ===========================================
   USE CASE 2: Class Schedule Management
   =========================================== */

// Add class session
app.post(
  "/api/classes",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const missing = requireFields(body, [
      "instructorId",
      "dayOfWeek",
      "timeHHmm",
      "classType",
      "payRate",
    ]);
    if (missing.length)
      return res
        .status(400)
        .json({ error: "Missing required fields", missing });

    // Validate instructor exists
    const instructor = await Instructor.findOne({
      instructorId: body.instructorId,
    });
    if (!instructor)
      return res
        .status(404)
        .json({ error: `Instructor '${body.instructorId}' not found` });

    const dayOfWeek = Number(body.dayOfWeek);
    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)
      return res.status(400).json({ error: "dayOfWeek must be 0-6" });

    // UC2: Check schedule conflict - only one class at a time per day/time slot
    const conflict = await ClassSession.findOne({
      dayOfWeek,
      timeHHmm: body.timeHHmm,
      isPublished: true,
    });

    if (conflict) {
      // UC2: Suggest alternative time slots (next 3 available slots on that day)
      const takenSlots = await ClassSession.find({
        dayOfWeek,
        isPublished: true,
      }).select("timeHHmm");

      const takenTimes = takenSlots.map((s) => s.timeHHmm);

      // Generate suggestions (every 30 min from 06:00 to 21:00)
      const suggestions = [];
      for (let h = 6; h <= 21; h++) {
        for (const min of ["00", "30"]) {
          const slot = `${String(h).padStart(2, "0")}:${min}`;
          if (!takenTimes.includes(slot)) suggestions.push(slot);
          if (suggestions.length >= 3) break;
        }
        if (suggestions.length >= 3) break;
      }

      return res.status(409).json({
        error: "Schedule conflict: a class already exists at this day and time.",
        conflict: {
          classId: conflict.classId,
          dayOfWeek: conflict.dayOfWeek,
          timeHHmm: conflict.timeHHmm,
        },
        suggestedSlots: suggestions,
        message:
          "Please re-submit with one of the suggested time slots or a different dayOfWeek.",
      });
    }

    const classId = await nextId("K", "class");
    const created = await ClassSession.create({
      classId,
      instructorId: body.instructorId,
      dayOfWeek,
      timeHHmm: body.timeHHmm,
      classType: body.classType,
      payRate: Number(body.payRate),
      isPublished: false, // default unpublished until manager confirms
    });

    res.status(201).json({
      message: "Class created. Use PATCH /api/classes/:id/publish to publish.",
      classSession: created,
    });
  })
);

// UC2: Publish a class (manager confirms and publishes)
app.patch(
  "/api/classes/:id/publish",
  asyncHandler(async (req, res) => {
    const classSession = await ClassSession.findOne({
      classId: req.params.id,
    });
    if (!classSession)
      return res.status(404).json({ error: "Class not found" });

    classSession.isPublished = true;
    await classSession.save();

    // UC2: Send confirmation to instructor
    const instructor = await Instructor.findOne({
      instructorId: classSession.instructorId,
    });

    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const msg = `A new class has been successfully scheduled: ${days[classSession.dayOfWeek]} at ${classSession.timeHHmm} (${classSession.classType}). Class ID: ${classSession.classId}.`;

    if (instructor) {
      const contact =
        instructor.preferredComm === "email"
          ? instructor.email
          : instructor.phone;
      sendMessage(instructor.preferredComm, contact, msg);
    }

    // Also notify manager (log as manager notification)
    console.log(`[MANAGER NOTIFICATION] ${msg}`);

    res.json({
      message: "Class published successfully.",
      classSession,
      notification: msg,
    });
  })
);

// Get all class sessions
app.get(
  "/api/classes",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.instructorId) filter.instructorId = req.query.instructorId;
    if (req.query.classType) filter.classType = req.query.classType;
    if (req.query.dayOfWeek !== undefined)
      filter.dayOfWeek = Number(req.query.dayOfWeek);

    const classes = await ClassSession.find(filter).sort({ dayOfWeek: 1, timeHHmm: 1 });
    res.json(classes);
  })
);

// Get single class session
app.get(
  "/api/classes/:id",
  asyncHandler(async (req, res) => {
    const cls = await ClassSession.findOne({ classId: req.params.id });
    if (!cls) return res.status(404).json({ error: "Class not found" });
    res.json(cls);
  })
);

/* ===========================================
   USE CASE 3: Package Management
   =========================================== */

// Add package
app.post(
  "/api/packages",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const missing = requireFields(body, [
      "packageName",
      "packageCategory",
      "numberOfClasses",
      "classType",
      "startDate",
      "endDate",
      "price",
    ]);
    if (missing.length)
      return res
        .status(400)
        .json({ error: "Missing required fields", missing });

    const packageId = await nextId("P", "package");
    const created = await Package.create({
      packageId,
      packageName: body.packageName.trim(),
      packageCategory: body.packageCategory,
      numberOfClasses: body.numberOfClasses,
      classType: body.classType,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      price: Number(body.price),
    });

    res.status(201).json({
      message: `Package '${created.packageName}' has been added successfully.`,
      package: created,
    });
  })
);

// Get all packages
app.get(
  "/api/packages",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.packageCategory)
      filter.packageCategory = req.query.packageCategory;
    if (req.query.classType) filter.classType = req.query.classType;

    const packages = await Package.find(filter).sort({ createdAt: -1 });
    res.json(packages);
  })
);

// Get single package
app.get(
  "/api/packages/:id",
  asyncHandler(async (req, res) => {
    const pkg = await Package.findOne({ packageId: req.params.id });
    if (!pkg) return res.status(404).json({ error: "Package not found" });
    res.json(pkg);
  })
);

/* ===========================================
   USE CASE 4: Customer Management
   =========================================== */

// Add customer
app.post(
  "/api/customers",
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    // UC4: Step 1 - check name first
    const nameMissing = requireFields(body, ["firstName", "lastName"]);
    if (nameMissing.length)
      return res
        .status(400)
        .json({ error: "Missing required fields", missing: nameMissing });

    const fName = body.firstName.trim();
    const lName = body.lastName.trim();

    // UC4: Step 2 - check duplicate name
    const existing = await Customer.find({
      firstName: fName,
      lastName: lName,
    }).limit(5);

    // UC4: Step 3 - prompt if duplicate
    if (existing.length > 0 && body.confirmDuplicate !== true) {
      return res.status(409).json({
        error: "Customer name already exists",
        message: "Re-submit with confirmDuplicate: true to proceed.",
        existing: existing.map((x) => ({
          customerId: x.customerId,
          firstName: x.firstName,
          lastName: x.lastName,
        })),
      });
    }

    // UC4: Step 4 - validate all required fields
    const allMissing = requireFields(body, [
      "firstName",
      "lastName",
      "preferredComm",
    ]);
    if (allMissing.length)
      return res
        .status(400)
        .json({ error: "Missing required fields", missing: allMissing });

    if (!["phone", "email"].includes(body.preferredComm)) {
      return res.status(400).json({
        error: "preferredComm must be 'phone' or 'email'",
      });
    }

    // UC4: Step 5 - generate customer ID with C prefix
    const customerId = await nextId("C", "customer");

    // UC4: Step 6 - save record with classBalance defaulting to 0
    const created = await Customer.create({
      customerId,
      firstName: fName,
      lastName: lName,
      address: body.address || "",
      phone: body.phone || "",
      email: body.email || "",
      preferredComm: body.preferredComm,
      classBalance: 0,
    });

    // UC4: Step 7 - confirm and send welcome message
    const msg = buildWelcomeMessage(
      "customer",
      created.firstName,
      created.customerId
    );
    const contact =
      created.preferredComm === "email" ? created.email : created.phone;
    sendMessage(created.preferredComm, contact, msg);

    res.status(201).json({
      message: "Customer record saved successfully.",
      customer: created,
      confirmationMessage: msg,
    });
  })
);

// Get all customers
app.get(
  "/api/customers",
  asyncHandler(async (req, res) => {
    const customers = await Customer.find().sort({ lastName: 1, firstName: 1 });
    res.json(customers);
  })
);

// Get single customer
app.get(
  "/api/customers/:id",
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.id });
    if (!customer)
      return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  })
);

// Update customer
app.put(
  "/api/customers/:id",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const updated = await Customer.findOneAndUpdate(
      { customerId: req.params.id },
      {
        $set: {
          ...(body.firstName && { firstName: body.firstName.trim() }),
          ...(body.lastName && { lastName: body.lastName.trim() }),
          ...(body.address !== undefined && { address: body.address }),
          ...(body.phone !== undefined && { phone: body.phone }),
          ...(body.email !== undefined && { email: body.email }),
          ...(body.preferredComm && { preferredComm: body.preferredComm }),
        },
      },
      { new: true }
    );
    if (!updated)
      return res.status(404).json({ error: "Customer not found" });
    res.json({ customer: updated });
  })
);

/* ===========================================
   USE CASE 5: Sales Route
   =========================================== */
app.post(
  "/api/sales",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const missing = requireFields(body, [
      "customerId",
      "packageId",
      "amountPaid",
      "paymentMode",
      "paidAt",
      "validityStart",
      "validityEnd",
    ]);
    if (missing.length)
      return res.status(400).json({ error: "Missing required fields", missing });

    const customer = await Customer.findOne({ customerId: body.customerId });
    if (!customer)
      return res.status(404).json({ error: `Customer '${body.customerId}' not found` });

    const pkg = await Package.findOne({ packageId: body.packageId });
    if (!pkg)
      return res.status(404).json({ error: `Package '${body.packageId}' not found` });

    if (Number(body.amountPaid) !== pkg.price) {
      return res.status(400).json({
        error: `Amount paid (${body.amountPaid}) does not match package price (${pkg.price}).`,
        expectedAmount: pkg.price,
      });
    }

    const saleId = await nextId("S", "sale");

    const sale = await Sale.create({
      saleId,
      customerId: body.customerId,
      packageId: body.packageId,
      amountPaid: Number(body.amountPaid),
      paymentMode: body.paymentMode,
      paidAt: new Date(body.paidAt),
      validityStart: new Date(body.validityStart),
      validityEnd: new Date(body.validityEnd),
    });

    const classesToAdd =
      pkg.numberOfClasses === "unlimited" ? 9999 : Number(pkg.numberOfClasses);

    const updatedCustomer = await Customer.findOneAndUpdate(
      { customerId: body.customerId },
      { $inc: { classBalance: classesToAdd } },
      { new: true }
    );

    res.status(201).json({
      message: "Sale recorded successfully.",
      sale,
      newClassBalance: updatedCustomer.classBalance,
    });
  })
);

app.get(
  "/api/sales",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.customerId) filter.customerId = req.query.customerId;
    if (req.query.packageId) filter.packageId = req.query.packageId;
    const sales = await Sale.find(filter).sort({ paidAt: -1 });
    res.json({ sales });
  })
);

/* ===========================================
   USE CASE 5: Attendance Routes
   =========================================== */
app.get(
  "/api/attendances/classes/:instructorId",
  asyncHandler(async (req, res) => {
    const classes = await ClassSession.find({
      instructorId: req.params.instructorId,
      isPublished: true,
    }).sort({ dayOfWeek: 1, timeHHmm: 1 });

    if (!classes.length)
      return res.status(404).json({ error: "No classes found for this instructor" });

    res.json({ classes });
  })
);

app.post(
  "/api/attendances",
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    const missing = requireFields(body, ["instructorId", "classId", "occurredAt"]);
    if (missing.length)
      return res.status(400).json({ error: "Missing required fields", missing });

    const instructor = await Instructor.findOne({ instructorId: body.instructorId });
    if (!instructor)
      return res.status(404).json({ error: `Instructor '${body.instructorId}' not found` });

    const classSession = await ClassSession.findOne({ classId: body.classId });
    if (!classSession)
      return res.status(404).json({ error: `Class '${body.classId}' not found` });

    const occurredAt = new Date(body.occurredAt);
    const occurredDay = occurredAt.getDay();
    let warning = "";
    if (occurredDay !== classSession.dayOfWeek) {
      const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      warning = `Warning: Class is scheduled for ${days[classSession.dayOfWeek]} but attendance is recorded for ${days[occurredDay]}.`;
    }

    const customerIds = body.customerIds || [];
    const negativeBalanceCustomers = [];
    const validCustomers = [];

    for (const cId of customerIds) {
      const customer = await Customer.findOne({ customerId: cId });
      if (!customer)
        return res.status(404).json({ error: `Customer '${cId}' not found` });

      if (customer.classBalance <= 0 && !body.allowNegative) {
        negativeBalanceCustomers.push({
          customerId: cId,
          firstName: customer.firstName,
          classBalance: customer.classBalance,
        });
      } else {
        validCustomers.push(customer);
      }
    }

    if (negativeBalanceCustomers.length > 0 && !body.allowNegative) {
      return res.status(400).json({
        error: "Some customers have insufficient class balance.",
        negativeBalanceCustomers,
        message: "Re-submit with allowNegative: true to save with negative balances.",
      });
    }

    const attendanceId = await nextId("A", "attendance");

    const attendance = await Attendance.create({
      attendanceId,
      instructorId: body.instructorId,
      classId: body.classId,
      occurredAt,
      customerIds,
      warning,
      allowNegative: body.allowNegative || false,
    });

    const updatedCustomers = [];
    for (const customer of validCustomers) {
      const updated = await Customer.findOneAndUpdate(
        { customerId: customer.customerId },
        { $inc: { classBalance: -1 } },
        { new: true }
      );

      const msg = buildCheckinMessage(
        updated.firstName,
        occurredAt,
        updated.classBalance
      );
      const contact =
        updated.preferredComm === "email" ? updated.email : updated.phone;
      sendMessage(updated.preferredComm, contact, msg);

      updatedCustomers.push({
        customerId: updated.customerId,
        firstName: updated.firstName,
        newClassBalance: updated.classBalance,
        message: msg,
      });
    }

    res.status(201).json({
      message: "Attendance recorded successfully.",
      attendance,
      warning: warning || null,
      updatedCustomers,
    });
  })
);

app.get(
  "/api/attendances",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.instructorId) filter.instructorId = req.query.instructorId;
    if (req.query.classId) filter.classId = req.query.classId;
    if (req.query.from || req.query.to) {
      filter.occurredAt = {};
      if (req.query.from) filter.occurredAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.occurredAt.$lte = new Date(req.query.to);
    }
    const attendances = await Attendance.find(filter).sort({ occurredAt: -1 });
    res.json({ attendances });
  })
);

app.get(
  "/api/attendances/:id",
  asyncHandler(async (req, res) => {
    const attendance = await Attendance.findOne({ attendanceId: req.params.id });
    if (!attendance)
      return res.status(404).json({ error: "Attendance not found" });
    res.json({ attendance });
  })
);
