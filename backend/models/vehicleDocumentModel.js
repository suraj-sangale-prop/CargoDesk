import executeQuery from "@/helpers/dbConnection";
import { getConstant, logQuery } from "@/utilities/utils";
import moment from "moment";
import { logFleetActivity } from "./fleetActivityModel";

export function addNewVehicleDocument(request, authUser = null) {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        vehicleNo = null,
        documentType = null,
        expiryDate = null,
        note = null,
        fleetId = null,
        isInAlertDate = null,
        alertDate = null,
        fleet_id = null,
      } = request;
      // 1. Resolve Organization ID securely from server session
      let orgId = authUser?.orgId ? Number(authUser.orgId) : null;

      // Fallback query if orgId was not in the JWT token
      if (!orgId && authUser?.userId) {
        const uRows = await executeQuery(
          "SELECT orgId FROM users WHERE userId = ? LIMIT 1",
          [authUser.userId],
        );
        if (uRows?.[0]?.orgId) {
          orgId = Number(uRows[0].orgId);
        }
      }

      // 2. If Super Admin, allow them to specify orgId in payload; otherwise lock to user's orgId
      const isSuperAdmin =
        authUser?.role === "super_admin" ||
        authUser?.email === "suraj@agnibyte.com";
      if (isSuperAdmin && request.orgId) {
        orgId = Number(request.orgId);
      }

      let finalFleetId = fleet_id || fleetId || null;

      // ... existing identifier fallback logic ...

      const tempObj = {
        fleet_id: finalFleetId ? Number(finalFleetId) : null,
        vehicleNo: vehicleNo || null,
        documentType,
        expiryDate,
        alertDate,
        isInAlertDate,
        note,
        orgId: orgId, // <-- Stored securely without trusting client payload!
      };

      const insertResult = await executeQuery(
        `INSERT INTO vehicle_documents SET ?`,
        [tempObj],
      );

      if (insertResult.affectedRows > 0) {
        const docId = insertResult.insertId;

        // Log Fleet Activity for centralized history (non-blocking)
        logFleetActivity({
          fleetId: fleetId || null,
          vehicleNo: vehicleNo || `Fleet #${fleetId}`,
          operationType: "DOCUMENT",
          entityType: (request.documentType || "DOCUMENT").toUpperCase(),
          entityId: String(docId),
          action: "UPLOAD",
          title: `${request.documentType || "Document"} uploaded`,
          description: request.expiryDate
            ? `Document expiry: ${moment(request.expiryDate).format("DD MMM YYYY")}`
            : `${request.documentType || "Document"} uploaded for vehicle ${vehicleNo || fleetId}`,
          oldValue: null,
          newValue: tempObj,
          changedFields: Object.keys(tempObj),
          performedByName: request.performedByName || "Admin User",
          source: "documents",
          metadata: {
            fleet_id: fleetId,
            vehicleNo,
            documentType: request.documentType,
            expiryDate: request.expiryDate,
          },
        }).catch((err) =>
          console.error("Error logging document upload activity:", err),
        );

        resolve({
          success: true,
          status: true,
          id: docId,
          fleet_id: fleetId,
          vehicleNo,
          message: "Vehicle document added successfully",
        });
      } else {
        reject(new Error("Insertion failed"));
      }
    } catch (error) {
      console.error("Error inserting vehicle document:", error);
      reject(error);
    }
  });
}

export function getAllVehicleDocuments(authUser = null) {
  return new Promise(async (resolve, reject) => {
    try {
      let orgId = authUser?.orgId ? Number(authUser.orgId) : null;
      const isSuperAdmin =
        authUser?.role === "super_admin" || authUser?.email === "suraj@agnibyte.com";

      // Build dynamic WHERE clause based on role and organization
      const whereClauses = [];
      const params = [];

      if (!isSuperAdmin) {
        if (orgId) {
          // Regular user: strictly limit to their organization (plus legacy null records if desired)
          whereClauses.push("(vd.orgId = ? OR vd.orgId IS NULL)");
          params.push(orgId);
        } else {
          whereClauses.push("vd.orgId IS NULL");
        }
      // } else if (request?.orgId) {
      //   // Super admin explicitly filtering by a specific organization
      //   whereClauses.push("vd.orgId = ?");
      //   params.push(Number(request.orgId));
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const selectQuery = `
        SELECT 
          vd.*,
          COALESCE(vd.fleet_id, f.id) AS fleet_id,
          COALESCE(f.vehicle_number, vd.vehicleNo) AS vehicleNo,
          f.vehicle_model,
          f.vehicle_type,
          f.status AS vehicle_status
        FROM vehicle_documents vd
        LEFT JOIN fleets f ON (
          (vd.fleet_id IS NOT NULL AND vd.fleet_id = f.id)
          OR (
            vd.fleet_id IS NULL 
            AND REPLACE(REPLACE(vd.vehicleNo, ' ', ''), '-', '') COLLATE utf8mb4_general_ci = 
                REPLACE(REPLACE(f.vehicle_number, ' ', ''), '-', '') COLLATE utf8mb4_general_ci
          )
        )
        ${whereSQL}
        ORDER BY vd.id DESC
      `;

      const result = await executeQuery(selectQuery, params);

      resolve({
        success: true,
        status: true,
        data: Array.isArray(result) ? result : [],
      });
    } catch (error) {
      console.error("Error fetching vehicle documents:", error);
      reject(error);
    }
  });
}

export function deleteVehicleDocumentByIds(ids) {
  return new Promise(async (resolve, reject) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      return reject(new Error("Invalid or empty array of IDs"));
    }

    try {
      const placeholders = ids.map(() => "?").join(",");
      // Single query to fetch existing docs, followed by single delete
      const [existingDocs, deleteResult] = await Promise.all([
        executeQuery(
          `SELECT * FROM vehicle_documents WHERE id IN (${placeholders})`,
          ids,
        ),
        executeQuery(
          `DELETE FROM vehicle_documents WHERE id IN (${placeholders})`,
          ids,
        ),
      ]);

      if (deleteResult.affectedRows > 0) {
        if (Array.isArray(existingDocs) && existingDocs.length > 0) {
          // Log activities concurrently without blocking
          Promise.all(
            existingDocs.map((doc) =>
              logFleetActivity({
                fleetId: doc.fleet_id || doc.fleetId || null,
                vehicleNo: doc.vehicleNo,
                operationType: "DOCUMENT",
                entityType: (doc.documentType || "DOCUMENT").toUpperCase(),
                entityId: String(doc.id),
                action: "DELETE",
                title: `${doc.documentType || "Document"} deleted`,
                description: `${doc.documentType || "Document"} removed for vehicle ${doc.vehicleNo || doc.fleet_id}`,
                oldValue: doc,
                newValue: null,
                changedFields: ["deleted"],
                performedByName: "Admin User",
                source: "documents",
              }),
            ),
          ).catch((err) =>
            console.error("Error logging document deletion activity:", err),
          );
        }

        resolve({
          success: true,
          status: true,
          message: `${deleteResult.affectedRows} vehicle document(s) deleted successfully`,
        });
      } else {
        reject(new Error("No records found with the given IDs"));
      }
    } catch (error) {
      console.error("Error deleting vehicle documents:", error);
      reject(error);
    }
  });
}

export function editVehicleDocumentById(id, updatedFields) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Fetch old document record before update for audit diff
      const oldRows = await executeQuery(
        `SELECT * FROM vehicle_documents WHERE id = ? LIMIT 1`,
        [id],
      );
      const oldDoc = oldRows?.[0] || null;

      // Reuse existing identifiers without making extra DB queries to fleets table
      const fleetId =
        updatedFields.fleet_id ||
        updatedFields.fleetId ||
        oldDoc?.fleet_id ||
        null;
      const vehicleNo = updatedFields.vehicleNo || oldDoc?.vehicleNo || null;

      // Calculate alertDate if expiryDate changed
      let alertDate = oldDoc?.alertDate || null;
      let isInAlertDate = oldDoc?.isInAlertDate || 0;

      if (updatedFields.expiryDate) {
        alertDate = moment(updatedFields.expiryDate)
          .subtract(getConstant("DAYS_BEFORE_ALERT"), "days")
          .format("YYYY-MM-DD");
        isInAlertDate = moment().isSameOrAfter(alertDate, "day") ? 1 : 0;
      }

      const fieldsToSave = {
        fleet_id: fleetId ? Number(fleetId) : null,
        vehicleNo: vehicleNo || null,
        documentType: updatedFields.documentType,
        expiryDate: updatedFields.expiryDate,
        alertDate,
        isInAlertDate,
        note: updatedFields.note,
      };

      const updateResult = await executeQuery(
        `UPDATE vehicle_documents SET ? WHERE id = ?`,
        [fieldsToSave, id],
      );

      if (updateResult.affectedRows > 0) {
        if (oldDoc) {
          const isExpiryChanged =
            updatedFields.expiryDate &&
            oldDoc.expiryDate !== updatedFields.expiryDate;
          let description = `${updatedFields.documentType || oldDoc.documentType || "Document"} updated`;

          if (isExpiryChanged) {
            const oldExpFormatted = oldDoc.expiryDate
              ? moment(oldDoc.expiryDate).format("DD MMM YYYY")
              : "N/A";
            const newExpFormatted = moment(updatedFields.expiryDate).format(
              "DD MMM YYYY",
            );
            description = `Expiry date changed from ${oldExpFormatted} → ${newExpFormatted}`;
          }

          logFleetActivity({
            fleetId: fleetId || oldDoc.fleet_id || null,
            vehicleNo: vehicleNo || oldDoc.vehicleNo,
            operationType: "DOCUMENT",
            entityType: (
              updatedFields.documentType ||
              oldDoc.documentType ||
              "DOCUMENT"
            ).toUpperCase(),
            entityId: String(id),
            action: isExpiryChanged ? "RENEW" : "UPDATE",
            title: `${updatedFields.documentType || oldDoc.documentType || "Document"} updated`,
            description,
            oldValue: oldDoc,
            newValue: { ...oldDoc, ...fieldsToSave },
            performedByName: updatedFields.performedByName || "Admin User",
            source: "documents",
            metadata: { fleet_id: fleetId, vehicleNo },
          }).catch((err) =>
            console.error("Error logging document edit activity:", err),
          );
        }

        resolve({
          success: true,
          status: true,
          message: "Vehicle document updated successfully",
        });
      } else {
        reject(
          new Error("No record found with the given ID or no changes made"),
        );
      }
    } catch (error) {
      console.error("Error updating vehicle document:", error);
      reject(error);
    }
  });
}
