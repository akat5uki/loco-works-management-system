export interface Employee {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string;
  category_id: number;
  category_name: string;
}

export interface GroupedEmployees {
  categoryName: string;
  designationId: number;
  designationName: string;
  employees: Employee[];
}

export const groupEmployees = (list: Employee[]): GroupedEmployees[] => {
  const map = new Map<number, GroupedEmployees>();
  
  list.forEach(emp => {
    if (!map.has(emp.designation_id)) {
      map.set(emp.designation_id, {
        categoryName: emp.category_name,
        designationId: emp.designation_id,
        designationName: emp.designation_name,
        employees: []
      });
    }
    map.get(emp.designation_id)!.employees.push(emp);
  });
  
  // Sort the groups by designationId ascending (hierarchical ranking)
  const sortedGroups = Array.from(map.values()).sort((a, b) => a.designationId - b.designationId);
  
  // Sort employees inside each group by ticket_number ascending
  sortedGroups.forEach(group => {
    group.employees.sort((a, b) => a.ticket_number - b.ticket_number);
  });
  
  return sortedGroups;
};
