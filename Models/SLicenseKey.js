const mongoose = require('mongoose')

const LicenseSchema = new mongoose.Schema(
    {
        licenseKey: {
            type: String,
        },
        lastRead: {
            type: Date,
        },
        // This is used for checking lastRead field tampering
        signature: {
            type: String,
        },
    },
    { timestamps: true }
)

module.exports = mongoose.model('SLicense', LicenseSchema)
