# Import all models here so that Alembic can discover them via Base.metadata
from src.core.database import Base  # noqa
from src.core.audit import AuditLog  # noqa
from src.modules.employees.models import Employee, Designation, EmployeeCategory  # noqa
from src.modules.jobs.models import Job, Task, EmployeeJobRating  # noqa
from src.modules.locos.models import Loco, LocoType  # noqa
from src.modules.bookings.models import LocoBooking  # noqa
