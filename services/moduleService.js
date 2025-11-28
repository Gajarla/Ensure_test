const { Module } = require('../Models/Module')

const getModuleById = async (id) => {
    try {
        let module = await Module.findById(id)
        return module
    } catch (err) {
        console.log(err)
        throw new Error('Error checking module name by id')
    }
}

module.exports = {
    getModuleById,
}
