// Certification api's

import express, { query } from 'express'
import { connectToDatabase } from './dbconnection.js'

const port = 3000;
const app = express();
app.use(express.json());
const db = await connectToDatabase();

app.get('/api/:empID/certs', async function (request, response) {    
    try {
        const queryParamsKeys = Object.keys(request.query);
        let empID = request.params.empID;
        let sortOption = request.query.sortOption || "CertName";
        let sortBy = request.query.sortBy || "ASC";

        let selectQuery = `SELECT Certificate.CertName, Certificate.OrganizationName, EmployeeCertificates.IssueDate, EmployeeCertificates.ExpireDate, EmployeeCertificates.CredentialID, EmployeeCertificates.CredentialURL 
        FROM EmployeeCertificates, Certificate 
        WHERE EmployeeCertificates.CertID = Certificate.CertID AND EmployeeCertificates.EmployeeID = ? 
        ORDER BY ${sortOption} ${sortBy};`
        
        const certs = await db.all(selectQuery, empID);
        response.status(200).send({ Certificates: certs, Status: true });
    } catch (error) {
        response.status(500).send({ Error: error, Status: false });
    }
});

app.post('/api/:empID/certs', async function (request, response) {
    let cert;
    let empID = request.params.empID;
    if (request.get('Content-Type') !== 'application/json') {
        response.status(400).send({ Error: "Invalid JSON", Status: false });
    } else {
        cert = request.body;
        try {
            let insertQuery = `INSERT INTO EmployeeCertificates (CertID, EmployeeID, IssueDate, ExpireDate, CredentialID, CredentialURL) VALUES (?, ?, ?, ?, ?, ?);`
            let affectedRow = await db.run(insertQuery, (await getCertID(cert.Certificate.CertName)), empID, cert.Certificate.IssueDate, cert.Certificate.ExpireDate, cert.Certificate.CredentialID, cert.Certificate.CredentialURL);

            let insertedCertificate = await getAffectedRow(affectedRow.lastID);
            response.status(201).send({ InsertedCertificate: insertedCertificate, ResponseMessage: "Certificate inserted successfully", Status: true });

        } catch (error) {
            if (error.code == "SQLITE_CONSTRAINT") {
                response.status(400).send({ Error: 'Failed to insert the certificate', Status: false});
            }
            response.status(500).send({ Error: error, Status: false });
            console.log(error);
        }
    }
});

app.put('/api/:empID/certs', async function (request, response) {
    try {
        let empID = request.params.empID;
        let certID = request.query.certID;
        let cert = request.body;

        let editQuery = `UPDATE EmployeeCertificates SET IssueDate = ?,  ExpireDate = ?, CredentialID = ?, CredentialURL = ? WHERE EmployeeID = ? AND CertID = ?;`;
        let affectedRow = await db.run(editQuery, cert.Certificate.IssueDate, cert.Certificate.ExpireDate, cert.Certificate.CredentialID, cert.Certificate.CredentialURL, empID, certID);
        
        if (affectedRow.changes == 1) {
            let editedCertificate = await getCertificate(empID, certID);
            response.status(200).send({ EditedCertificate: editedCertificate, ResponseMessage: "Certificate edited successfully", Status: true });
        } else {
            response.status(400).send({ Status: 'Failed to edit the certificate', Status: false });
        }
    } catch (error) {
        console.log(error);
        response.status(500).send({ Error: error, Status: false });
    }
});

app.delete('/api/:empID/certs', async function (request, response) {
    try {
        let empID = request.params.empID;
        let certID = request.query.certID;

        let deleteQuery = `DELETE FROM EmployeeCertificates WHERE CertID = ? AND EmployeeID = ?;`;
        let deletedCertificate = await getCertificate(empID, certID);
        const affectedRow = await db.run(deleteQuery, certID, empID);

        if (affectedRow.changes == 1) {
            response.send({ DeletedCertificate: deletedCertificate, Status: "Certificate deleted successfully", Status: true });
        } else {
            response.status(400).send({ ResponseMessage: 'Failed to delete the certificate', Status: false });
        }
    } catch (error) {
        console.log(error);
        response.status(500).send({ Error: error, Status: false });
    }
});

app.get('/api/:empID/certs/searchCert', async function (request, response) {
    let empID = request.params.empID;
    const queryParamsKeys = Object.keys(request.query);
    let optionKey = queryParamsKeys[0];
    let searchOption = request.query[optionKey];

    // const certs = await getCert(empID, searchOption);
    response.send(certs);
});

app.listen(port, function () {
    console.log(`Server is running on port: ${port}.`);
});

async function getCertID(certName) {
    let certIDQuery = `SELECT CertID FROM Certificate WHERE CertName = '${certName}'`;
    try {
        return (await db.get(certIDQuery)).CertID;
    } catch (error) {
        console.log(error);
        return null;
    }
}

async function getAffectedRow(affectedRowID) {
    let affectedRowQuery = `SELECT Certificate.CertName, Certificate.OrganizationName, EmployeeCertificates.IssueDate, EmployeeCertificates.ExpireDate, EmployeeCertificates.CredentialID, EmployeeCertificates.CredentialURL
    FROM Certificate JOIN EmployeeCertificates ON Certificate.CertID = EmployeeCertificates.CertID
    WHERE EmployeeCertificates.rowid = ?`;
    try {
        return (await db.get(affectedRowQuery, affectedRowID));
    } catch (error) {
        return error;
    }
}

async function getCertificate(empID, certID) {
    let query = `SELECT Certificate.CertName, Certificate.OrganizationName, EmployeeCertificates.IssueDate, EmployeeCertificates.ExpireDate, EmployeeCertificates.CredentialID, EmployeeCertificates.CredentialURL
    FROM Certificate JOIN EmployeeCertificates ON Certificate.CertID = EmployeeCertificates.CertID
    WHERE EmployeeCertificates.EmployeeID = ? AND EmployeeCertificates.CertID = ?`;
    try {
        return (await db.get(query, empID, certID));
    } catch (error) {
        return error;
    }
}
