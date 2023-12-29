const { MONTHS } = require("./constants")

const getMonth = (ind)=>{
    return MONTHS[ind]
}
function getMonthIndex(monthName) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months.indexOf(monthName);
}
function createSlots(count) {
    const slots = [];
    let currentDate = new Date();

    for (let i = 0; i < 12; i++) {
        let startDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 30);
        let endDate = new Date(currentDate);

        slots.push({
            start_date: startDate,
            count: count,
            used: 0,
            end_date: endDate
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return slots;
}
function createSlotsFromDate(count, currentDate) {
    const slots = [];
    for (let i = 0; i < 12; i++) {
        let startDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 30);
        let endDate = new Date(currentDate);

        slots.push({
            start_date: startDate,
            count: count,
            used: 0,
            end_date: endDate
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return slots;
}

function findCurrentSlotAndDaysToEnd(slots) {
    const today = new Date().toISOString().slice(0, 10); 
    for (let slot of slots) {
        const startDateStr = slot.start_date.toISOString().slice(0, 10);
        const endDateStr = slot.end_date.toISOString().slice(0, 10);

        if (today >= startDateStr && today <= endDateStr) {
            const differenceInTime = slot.end_date - new Date();
            const oneDay = 24 * 60 * 60 * 1000; 
            const differenceInDays = Math.ceil(differenceInTime / oneDay);
            return {
                slot: slot,
                daysTillEndDate: differenceInDays
            };
        }
    }
    return null;
}
function getMyPremiumPlan(plan){
    let slots = plan.slots
    let temp_slots = findCurrentSlotAndDaysToEnd(slots)
    let mySlot = temp_slots.slot
    mySlot.remainingDays = temp_slots.daysTillEndDate
    mySlot.name = plan.name
    mySlot.balance = parseInt(mySlot.count) - parseInt(mySlot.used)
    mySlot.status = (mySlot.remainingDays>0 &&  mySlot.balance>0 )?"Active":"Inactive"
    mySlot.topup = plan.topup?plan.topup:0
    mySlot.color = plan.color
    return mySlot
}
function findSlotIndex(slots) {
    const today = new Date();

    for (let i = 0; i < slots.length; i++) {
        const startDate = new Date(slots[i].start_date);
        const endDate = new Date(slots[i].end_date);

        if (today >= startDate && today <= endDate) {
            return i;
        }
    }
    return -1; 
}
module.exports = {
    findSlotIndex,
    createSlotsFromDate,
    getMyPremiumPlan,
    findCurrentSlotAndDaysToEnd,
    createSlots,
    getMonth,
    getMonthIndex
}